from __future__ import annotations

from datetime import date, datetime, timedelta
from io import StringIO
import csv

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.api import deps
from app.db.models.accounting import Expense, Invoice, InvoiceStatus
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.reports import (
  AgingBucket,
  AgingReport,
  ReportEmailRequest,
  SalesByCustomerRow,
  SummaryPoint,
  SummaryReport,
)
from app.utils.email_queue import KIND_REPORT, enqueue_email
from app.utils.invoice_payments import invoice_balance_due

router = APIRouter(tags=["reports"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=400, detail="Tenant not resolved")
  return tenant_id


def _parse_date(value: str | None) -> date | None:
  if not value:
    return None
  try:
    return date.fromisoformat(value)
  except ValueError:
    return None


def _period_key(dt: date, interval: str) -> str:
  if interval == "day":
    return dt.isoformat()
  if interval == "year":
    return f"{dt.year}"
  if interval == "quarter":
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}-Q{q}"
  # default month
  return f"{dt.year}-{dt.month:02d}"


@router.get("/summary", response_model=SummaryReport)
def summary_report(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
  date_from: str | None = Query(None),
  date_to: str | None = Query(None),
  interval: str = Query("month", pattern="^(day|month|quarter|year)$"),
):
  tenant_id = _get_tenant_id_or_400()
  today = date.today()

  d_from = _parse_date(date_from)
  d_to = _parse_date(date_to)
  if not d_to:
    d_to = today
  if not d_from:
    d_from = d_to - timedelta(days=365)

  invoices = (
    db.query(Invoice)
    .options(joinedload(Invoice.payments))
    .filter(
      Invoice.tenant_id == tenant_id,
      Invoice.issue_date >= d_from,
      Invoice.issue_date <= d_to,
    )
    .all()
  )
  expenses = (
    db.query(Expense)
    .filter(
      Expense.tenant_id == tenant_id,
      Expense.date >= d_from,
      Expense.date <= d_to,
      Expense.is_deleted.is_(False),
    )
    .all()
  )

  series_map: dict[str, dict[str, float]] = {}
  total_revenue = 0.0
  total_expenses = 0.0

  for inv in invoices:
    issue = inv.issue_date or inv.created_at.date()
    key = _period_key(issue, interval)
    s = series_map.setdefault(key, {"revenue": 0.0, "expenses": 0.0})
    amount = float(inv.total or 0)
    s["revenue"] += amount
    total_revenue += amount

  for exp in expenses:
    key = _period_key(exp.date, interval)
    s = series_map.setdefault(key, {"revenue": 0.0, "expenses": 0.0})
    amount = float(exp.amount or 0)
    s["expenses"] += amount
    total_expenses += amount

  points: list[SummaryPoint] = []
  for key in sorted(series_map.keys()):
    r = series_map[key]["revenue"]
    e = series_map[key]["expenses"]
    points.append(SummaryPoint(period=key, revenue=r, expenses=e, profit=r - e))

  outstanding_total = 0.0
  outstanding_count = 0
  for inv in invoices:
    if inv.status == InvoiceStatus.cancelled:
      continue
    balance = float(invoice_balance_due(inv))
    if balance > 0.01:
      outstanding_total += balance
      outstanding_count += 1

  avg_invoice = total_revenue / len(invoices) if invoices else 0.0

  return SummaryReport(
    date_from=d_from,
    date_to=d_to,
    interval=interval,  # type: ignore[arg-type]
    currency="ZAR",
    total_revenue=total_revenue,
    total_expenses=total_expenses,
    total_profit=total_revenue - total_expenses,
    outstanding_invoices_total=outstanding_total,
    outstanding_invoices_count=outstanding_count,
    average_invoice_value=avg_invoice,
    series=points,
  )


@router.get("/sales-by-customer", response_model=list[SalesByCustomerRow])
def sales_by_customer(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
  date_from: str | None = Query(None),
  date_to: str | None = Query(None),
  limit: int = Query(10, ge=1, le=100),
):
  tenant_id = _get_tenant_id_or_400()
  d_from = _parse_date(date_from)
  d_to = _parse_date(date_to) or date.today()
  if not d_from:
    d_from = d_to - timedelta(days=365)

  invoices = (
    db.query(Invoice)
    .filter(
      Invoice.tenant_id == tenant_id,
      Invoice.issue_date >= d_from,
      Invoice.issue_date <= d_to,
    )
    .all()
  )
  agg: dict[str, dict[str, float]] = {}
  for inv in invoices:
    name = (inv.customer_name or "Unknown").strip() or "Unknown"
    row = agg.setdefault(name, {"revenue": 0.0, "count": 0})
    row["revenue"] += float(inv.total or 0)
    row["count"] += 1

  rows = [
    SalesByCustomerRow(customer_name=name, revenue=data["revenue"], invoice_count=int(data["count"]))
    for name, data in agg.items()
  ]
  rows.sort(key=lambda r: r.revenue, reverse=True)
  return rows[:limit]


@router.get("/aging", response_model=AgingReport)
def aging_report(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
  as_of: str | None = Query(None),
):
  tenant_id = _get_tenant_id_or_400()
  as_of_date = _parse_date(as_of) or date.today()

  invoices = (
    db.query(Invoice)
    .options(joinedload(Invoice.payments))
    .filter(Invoice.tenant_id == tenant_id)
    .all()
  )

  buckets_def = [
    ("Not due", -9999, -1),
    ("0-30 days", 0, 30),
    ("31-60 days", 31, 60),
    ("61-90 days", 61, 90),
    (">90 days", 91, 9999),
  ]
  bucket_data = {label: {"days_min": dmin, "days_max": dmax, "total": 0.0, "count": 0} for label, dmin, dmax in buckets_def}

  for inv in invoices:
    if inv.status == InvoiceStatus.cancelled:
      continue
    amount = float(invoice_balance_due(inv))
    if amount <= 0.01:
      continue
    due = inv.due_date or (inv.issue_date or as_of_date) + timedelta(days=30)
    days_overdue = (as_of_date - due).days
    for label, dmin, dmax in buckets_def:
      if dmin <= days_overdue <= dmax:
        b = bucket_data[label]
        b["total"] += amount
        b["count"] += 1
        break

  buckets: list[AgingBucket] = []
  for label, dmin, dmax in buckets_def:
    data = bucket_data[label]
    buckets.append(
      AgingBucket(
        label=label,
        days_min=dmin,
        days_max=None if dmax == 9999 else dmax,
        total=data["total"],
        count=int(data["count"]),
      )
    )

  return AgingReport(as_of=as_of_date, currency="ZAR", buckets=buckets)


def _summary_csv(report: SummaryReport) -> bytes:
  buf = StringIO()
  writer = csv.writer(buf)
  writer.writerow(["period", "revenue", "expenses", "profit"])
  for p in report.series:
    writer.writerow([p.period, f"{p.revenue:.2f}", f"{p.expenses:.2f}", f"{p.profit:.2f}"])
  return buf.getvalue().encode("utf-8")


def _sales_by_customer_csv(rows: list[SalesByCustomerRow]) -> bytes:
  buf = StringIO()
  writer = csv.writer(buf)
  writer.writerow(["customer_name", "revenue", "invoice_count"])
  for r in rows:
    writer.writerow([r.customer_name, f"{r.revenue:.2f}", r.invoice_count])
  return buf.getvalue().encode("utf-8")


def _aging_csv(report: AgingReport) -> bytes:
  buf = StringIO()
  writer = csv.writer(buf)
  writer.writerow(["bucket", "days_min", "days_max", "total", "count"])
  for b in report.buckets:
    writer.writerow([b.label, b.days_min, b.days_max if b.days_max is not None else "", f"{b.total:.2f}", b.count])
  return buf.getvalue().encode("utf-8")


def _invoices_csv(invoices: list[Invoice]) -> bytes:
  buf = StringIO()
  writer = csv.writer(buf)
  writer.writerow(
    [
      "invoice_number",
      "customer_name",
      "issue_date",
      "due_date",
      "currency",
      "total",
      "status",
    ]
  )
  for inv in invoices:
    writer.writerow(
      [
        inv.invoice_number,
        inv.customer_name,
        inv.issue_date.isoformat() if inv.issue_date else "",
        inv.due_date.isoformat() if inv.due_date else "",
        inv.currency,
        f"{float(inv.total or 0):.2f}",
        inv.status,
      ]
    )
  return buf.getvalue().encode("utf-8")


def _expenses_csv(expenses: list[Expense]) -> bytes:
  buf = StringIO()
  writer = csv.writer(buf)
  writer.writerow(
    [
      "date",
      "vendor_id",
      "category_id",
      "description",
      "currency",
      "amount",
      "tax_amount",
      "status",
    ]
  )
  for exp in expenses:
    writer.writerow(
      [
        exp.date.isoformat(),
        exp.vendor_id or "",
        exp.category_id or "",
        exp.description,
        exp.currency,
        f"{float(exp.amount or 0):.2f}",
        f"{float(exp.tax_amount or 0):.2f}",
        exp.status,
      ]
    )
  return buf.getvalue().encode("utf-8")


@router.get("/download")
def download_report(
  report_type: str = Query("summary"),
  date_from: str | None = Query(None),
  date_to: str | None = Query(None),
  as_of: str | None = Query(None),
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  filename = f"{report_type}-report.csv"

  if report_type == "summary":
    rep = summary_report(db=db, ctx=ctx, date_from=date_from, date_to=date_to, interval="month")
    data = _summary_csv(rep)
  elif report_type == "sales_by_customer":
    rows = sales_by_customer(db=db, ctx=ctx, date_from=date_from, date_to=date_to, limit=100)
    data = _sales_by_customer_csv(rows)
  elif report_type == "aging":
    rep = aging_report(db=db, ctx=ctx, as_of=as_of)
    data = _aging_csv(rep)
  elif report_type == "invoices":
    d_from = _parse_date(date_from)
    d_to = _parse_date(date_to) or date.today()
    if not d_from:
      d_from = d_to - timedelta(days=365)
    invoices = (
      db.query(Invoice)
      .filter(
        Invoice.tenant_id == tenant_id,
        Invoice.issue_date >= d_from,
        Invoice.issue_date <= d_to,
      )
      .all()
    )
    data = _invoices_csv(invoices)
  elif report_type == "expenses":
    d_from = _parse_date(date_from)
    d_to = _parse_date(date_to) or date.today()
    if not d_from:
      d_from = d_to - timedelta(days=365)
    expenses = (
      db.query(Expense)
      .filter(
        Expense.tenant_id == tenant_id,
        Expense.date >= d_from,
        Expense.date <= d_to,
        Expense.is_deleted.is_(False),
      )
      .all()
    )
    data = _expenses_csv(expenses)
  else:
    raise HTTPException(status_code=400, detail="Unknown report_type")

  return StreamingResponse(
    iter([data]),
    media_type="text/csv",
    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
  )


@router.post("/email")
def email_report(
  payload: ReportEmailRequest,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  report_type = payload.report_type

  # Reuse download helpers to generate CSV
  if report_type == "summary":
    rep = summary_report(db=db, ctx=ctx, date_from=payload.date_from.isoformat() if payload.date_from else None, date_to=payload.date_to.isoformat() if payload.date_to else None, interval="month")
    data = _summary_csv(rep)
  elif report_type == "sales_by_customer":
    rows = sales_by_customer(
      db=db,
      ctx=ctx,
      date_from=payload.date_from.isoformat() if payload.date_from else None,
      date_to=payload.date_to.isoformat() if payload.date_to else None,
      limit=100,
    )
    data = _sales_by_customer_csv(rows)
  elif report_type == "aging":
    rep = aging_report(db=db, ctx=ctx, as_of=payload.as_of.isoformat() if payload.as_of else None)
    data = _aging_csv(rep)
  elif report_type == "invoices":
    d_from = payload.date_from or (date.today() - timedelta(days=365))
    d_to = payload.date_to or date.today()
    invoices = (
      db.query(Invoice)
      .filter(
        Invoice.tenant_id == tenant_id,
        Invoice.issue_date >= d_from,
        Invoice.issue_date <= d_to,
      )
      .all()
    )
    data = _invoices_csv(invoices)
  elif report_type == "expenses":
    d_from = payload.date_from or (date.today() - timedelta(days=365))
    d_to = payload.date_to or date.today()
    expenses = (
      db.query(Expense)
      .filter(
        Expense.tenant_id == tenant_id,
        Expense.date >= d_from,
        Expense.date <= d_to,
        Expense.is_deleted.is_(False),
      )
      .all()
    )
    data = _expenses_csv(expenses)
  else:
    raise HTTPException(status_code=400, detail="Unknown report_type")

  subject = f"{report_type.replace('_', ' ').title()} report"
  filename = f"{report_type}-report.csv"
  import base64
  import time

  enqueue_email(
    db,
    kind=KIND_REPORT,
    to_email=payload.to_email,
    payload={
      "subject": subject,
      "body": "Please find the report attached.",
      "filename": filename,
      "attachment_base64": base64.b64encode(data).decode("ascii"),
    },
    idempotency_key=f"report:{tenant_id}:{report_type}:{payload.to_email}:{int(time.time())}",
  )
  return {"ok": True, "message": f"Report email queued to {payload.to_email}"}


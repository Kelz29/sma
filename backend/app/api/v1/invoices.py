import uuid as uuid_mod
from datetime import date
from decimal import Decimal
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api import deps
from app.db.models.accounting import Customer, Invoice, InvoiceLine, InvoicePayment, InvoiceStatus
from app.db.models.tenant import Tenant
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.accounting import (
  InvoiceCreate,
  InvoicePaymentCreate,
  InvoicePaymentRead,
  InvoiceRead,
  InvoiceUpdate,
)
from app.utils.audit import log_audit
from app.utils.invoice_html import build_invoice_html
from app.utils.invoice_payments import (
  invoice_amount_paid,
  invoice_balance_due,
  sync_invoice_status_from_payments,
)

router = APIRouter(tags=["invoices"])


def _render_invoice_pdf(html_body: str) -> bytes:
  from app.utils.pdf import render_invoice_pdf
  return render_invoice_pdf(html_body=html_body)


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


def _calculate_totals(
  lines_data,
  *,
  discount_type: str | None = None,
  discount_value: float | None = None,
):
  """Return subtotal, discount_amount, discount_percent, vat_amount, total.

  Discount is applied to the subtotal before VAT. Line VAT is scaled
  proportionally so mixed rates stay consistent.
  """
  subtotal = 0.0
  vat_gross = 0.0
  for line in lines_data:
    line_total = float(line.quantity) * float(line.unit_price)
    subtotal += line_total
    if line.vat_rate is not None:
      vat_gross += line_total * float(line.vat_rate) / 100.0

  discount_amount = 0.0
  discount_percent: float | None = None
  dtype = (discount_type or "").strip().lower() or None
  dval = float(discount_value) if discount_value is not None else None
  if dtype == "percent" and dval is not None and dval > 0:
    discount_percent = min(100.0, max(0.0, dval))
    discount_amount = subtotal * discount_percent / 100.0
  elif dtype == "amount" and dval is not None and dval > 0:
    discount_amount = dval
  else:
    dtype = None

  discount_amount = max(0.0, min(discount_amount, subtotal))
  if discount_amount <= 0:
    dtype = None
    discount_percent = None
    discount_amount = 0.0

  if subtotal > 0 and discount_amount > 0:
    scale = (subtotal - discount_amount) / subtotal
    vat_amount = vat_gross * scale
  else:
    vat_amount = vat_gross

  total = subtotal - discount_amount + vat_amount
  return subtotal, discount_amount, discount_percent, vat_amount, total, dtype


def _to_invoice_read(invoice: Invoice) -> InvoiceRead:
  paid = invoice_amount_paid(invoice)
  balance = invoice_balance_due(invoice)
  data = InvoiceRead.model_validate(invoice)
  return data.model_copy(
    update={
      "amount_paid": paid,
      "balance_due": balance,
      "payments": [InvoicePaymentRead.model_validate(p) for p in (invoice.payments or [])],
    }
  )


def _load_invoice(db: Session, tenant_id: int, invoice_id: int) -> Invoice | None:
  return (
    db.query(Invoice)
    .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
    .filter(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    .first()
  )


@router.get("/", response_model=List[InvoiceRead])
def list_invoices(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoices = (
    db.query(Invoice)
    .options(joinedload(Invoice.lines), joinedload(Invoice.payments))
    .filter(Invoice.tenant_id == tenant_id)
    .order_by(Invoice.issue_date.desc(), Invoice.invoice_number.desc())
    .all()
  )
  return [_to_invoice_read(inv) for inv in invoices]


# Sample data for preview (must be before /{invoice_id} routes)
SAMPLE_PREVIEW = {
  "doc_number": 10042,
  "customer_name": "Acme Corporation",
  "customer_email": "billing@acme.example",
  "issue_date": date(2025, 3, 15),
  "due_date": date(2025, 4, 15),
  "currency": "ZAR",
  "subtotal": 2400.0,
  "vat_amount": 480.0,
  "total": 2880.0,
  "vat_rate": 20.0,
  "vat_country": "US",
  "notes": "Payment terms: Net 30. Please include the invoice number with your payment.",
  "lines": [
    {"description": "Consulting — Phase 1", "quantity": 40, "unit_price": 50, "line_total": 2000},
    {"description": "Setup & onboarding", "quantity": 1, "unit_price": 400, "line_total": 400},
  ],
}


@router.get("/preview")
def preview_invoice_html(
  theme: Literal["classic", "modern", "minimal", "elegant", "bold", "professional"] = "classic",
  doctype: Literal["invoice", "quotation"] = "invoice",
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  """Return HTML preview of how an invoice/quotation looks with the given theme and doctype."""
  tenant_id = _get_tenant_id_or_400()
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  company_name = tenant.name if tenant else "Your Company"
  company_logo_url = getattr(tenant, "logo_url", None) if tenant else None
  company_address = getattr(tenant, "address", None) if tenant else None
  footer_text = getattr(tenant, "footer_text", None) if tenant else None
  bank_name = getattr(tenant, "bank_name", None) if tenant else None
  bank_account_number = getattr(tenant, "bank_account_number", None) if tenant else None
  bank_branch_code = getattr(tenant, "bank_branch_code", None) if tenant else None
  primary_color = getattr(tenant, "primary_color", None) if tenant else None
  secondary_color = getattr(tenant, "secondary_color", None) if tenant else None

  html = build_invoice_html(
    title="",
    doc_number=SAMPLE_PREVIEW["doc_number"],
    customer_name=SAMPLE_PREVIEW["customer_name"],
    customer_email=SAMPLE_PREVIEW["customer_email"],
    issue_date=SAMPLE_PREVIEW["issue_date"],
    due_date=SAMPLE_PREVIEW["due_date"],
    currency=SAMPLE_PREVIEW["currency"],
    subtotal=SAMPLE_PREVIEW["subtotal"],
    vat_amount=SAMPLE_PREVIEW["vat_amount"],
    total=SAMPLE_PREVIEW["total"],
    vat_rate=SAMPLE_PREVIEW["vat_rate"],
    vat_country=SAMPLE_PREVIEW["vat_country"],
    notes=SAMPLE_PREVIEW["notes"],
    lines=SAMPLE_PREVIEW["lines"],
    theme=theme,
    doctype=doctype,
    company_name=company_name,
    company_logo_url=company_logo_url,
    company_address=company_address,
    footer_text=footer_text,
    bank_name=bank_name,
    bank_account_number=bank_account_number,
    bank_branch_code=bank_branch_code,
    primary_color=primary_color,
    secondary_color=secondary_color,
  )
  return HTMLResponse(html)


@router.post("/", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def create_invoice(
  payload: InvoiceCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()

  if not payload.lines or len(payload.lines) == 0:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="At least one line item is required.",
    )

  customer_name: str
  customer_email: str | None = None
  customer_id: int | None = None
  if payload.customer_id:
    customer = db.query(Customer).filter(
      Customer.tenant_id == tenant_id,
      Customer.id == payload.customer_id,
    ).first()
    if not customer:
      raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    customer_name = customer.name
    customer_email = customer.email
    customer_id = customer.id
  else:
    if not payload.customer_name or not payload.customer_name.strip():
      raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="customer_name required when customer_id is not set")
    customer_name = payload.customer_name.strip()
    customer_email = (payload.customer_email or "").strip() or None

  if payload.invoice_number is not None:
    existing = db.query(Invoice).filter(
      Invoice.tenant_id == tenant_id,
      Invoice.invoice_number == payload.invoice_number,
    ).first()
    if existing:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invoice number {payload.invoice_number} is already used for this company.",
      )
    doc_number = payload.invoice_number
  else:
    current_max = db.query(func.max(Invoice.invoice_number)).filter(Invoice.tenant_id == tenant_id).scalar()
    doc_number = (current_max or 0) + 1
  subtotal, discount_amount, discount_percent, vat_amount, total, dtype = _calculate_totals(
    payload.lines,
    discount_type=payload.discount_type,
    discount_value=float(payload.discount_value) if payload.discount_value is not None else None,
  )

  invoice = Invoice(
    uuid=str(uuid_mod.uuid4()),
    tenant_id=tenant_id,
    customer_id=customer_id,
    invoice_number=doc_number,
    customer_name=customer_name,
    customer_email=customer_email,
    issue_date=payload.issue_date,
    due_date=payload.due_date,
    currency=payload.currency,
    vat_rate=payload.vat_rate,
    vat_country=payload.vat_country,
    notes=payload.notes,
    status=InvoiceStatus.draft,
    is_recurring=payload.is_recurring,
    recurring_interval_days=payload.recurring_interval_days,
    subtotal=subtotal,
    discount_type=dtype,
    discount_percent=discount_percent,
    discount_amount=discount_amount,
    vat_amount=vat_amount,
    total=total,
  )
  db.add(invoice)
  db.flush()

  for line_data in payload.lines:
    line_total = float(line_data.quantity) * float(line_data.unit_price)
    line = InvoiceLine(
      tenant_id=tenant_id,
      invoice_id=invoice.id,
      description=line_data.description,
      quantity=line_data.quantity,
      unit_price=line_data.unit_price,
      vat_rate=line_data.vat_rate,
      line_total=line_total,
    )
    db.add(line)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="create_invoice",
    entity_type="Invoice",
    entity_id=str(invoice.id),
    details=f"Created invoice {invoice.invoice_number}",
    new_values={
      "invoice_number": invoice.invoice_number,
      "customer_name": invoice.customer_name,
      "customer_email": invoice.customer_email,
      "issue_date": str(invoice.issue_date),
      "due_date": str(invoice.due_date) if invoice.due_date else None,
      "currency": invoice.currency,
      "subtotal": float(invoice.subtotal),
      "vat_amount": float(invoice.vat_amount),
      "total": float(invoice.total),
      "status": invoice.status.value,
    },
  )

  db.commit()
  db.refresh(invoice)
  invoice = _load_invoice(db, tenant_id, invoice.id)
  return _to_invoice_read(invoice)


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(
  invoice_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  return _to_invoice_read(invoice)


@router.put("/{invoice_id}", response_model=InvoiceRead)
def update_invoice(
  invoice_id: int,
  payload: InvoiceUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  before = {
    "customer_name": invoice.customer_name,
    "customer_email": invoice.customer_email,
    "issue_date": str(invoice.issue_date),
    "due_date": str(invoice.due_date) if invoice.due_date else None,
    "currency": invoice.currency,
    "vat_rate": float(invoice.vat_rate) if invoice.vat_rate is not None else None,
    "vat_country": invoice.vat_country,
    "notes": invoice.notes,
    "is_recurring": invoice.is_recurring,
    "recurring_interval_days": invoice.recurring_interval_days,
    "status": invoice.status.value,
    "subtotal": float(invoice.subtotal),
    "discount_type": invoice.discount_type,
    "discount_percent": float(invoice.discount_percent) if invoice.discount_percent is not None else None,
    "discount_amount": float(invoice.discount_amount or 0),
    "vat_amount": float(invoice.vat_amount),
    "total": float(invoice.total),
  }

  if payload.customer_name is not None:
    invoice.customer_name = payload.customer_name
  if payload.customer_email is not None:
    invoice.customer_email = payload.customer_email
  if payload.issue_date is not None:
    invoice.issue_date = payload.issue_date
  if payload.due_date is not None:
    invoice.due_date = payload.due_date
  if payload.currency is not None:
    invoice.currency = payload.currency
  if payload.vat_rate is not None:
    invoice.vat_rate = payload.vat_rate
  if payload.vat_country is not None:
    invoice.vat_country = payload.vat_country
  if payload.notes is not None:
    invoice.notes = payload.notes
  if payload.is_recurring is not None:
    invoice.is_recurring = payload.is_recurring
  if payload.recurring_interval_days is not None:
    invoice.recurring_interval_days = payload.recurring_interval_days

  recalc_discount = (
    payload.clear_discount
    or payload.discount_type is not None
    or payload.discount_value is not None
    or payload.lines is not None
  )
  if payload.lines is not None:
    invoice.lines.clear()
    for line_data in payload.lines:
      line_total = float(line_data.quantity) * float(line_data.unit_price)
      invoice.lines.append(
        InvoiceLine(
          tenant_id=tenant_id,
          description=line_data.description,
          quantity=line_data.quantity,
          unit_price=line_data.unit_price,
          vat_rate=line_data.vat_rate,
          line_total=line_total,
        )
      )

  if recalc_discount:
    if payload.clear_discount:
      dtype, dval = None, None
    elif payload.discount_type is not None or payload.discount_value is not None:
      dtype = payload.discount_type if payload.discount_type is not None else invoice.discount_type
      if payload.discount_value is not None:
        dval = float(payload.discount_value)
      elif dtype == "percent" and invoice.discount_percent is not None:
        dval = float(invoice.discount_percent)
      elif dtype == "amount":
        dval = float(invoice.discount_amount or 0)
      else:
        dval = None
    else:
      dtype = invoice.discount_type
      if dtype == "percent" and invoice.discount_percent is not None:
        dval = float(invoice.discount_percent)
      elif dtype == "amount":
        dval = float(invoice.discount_amount or 0)
      else:
        dval = None

    lines_for_calc = payload.lines if payload.lines is not None else [
      type("L", (), {
        "quantity": ln.quantity,
        "unit_price": ln.unit_price,
        "vat_rate": ln.vat_rate,
      })()
      for ln in invoice.lines
    ]
    subtotal, discount_amount, discount_percent, vat_amount, total, dtype = _calculate_totals(
      lines_for_calc,
      discount_type=dtype,
      discount_value=dval,
    )
    invoice.subtotal = subtotal
    invoice.discount_type = dtype
    invoice.discount_percent = discount_percent
    invoice.discount_amount = discount_amount
    invoice.vat_amount = vat_amount
    invoice.total = total

  if payload.status is not None:
    if payload.status not in {s.value for s in InvoiceStatus}:
      raise HTTPException(status_code=400, detail="Invalid invoice status")
    # Marking paid without a payment record: auto-record remaining balance
    if payload.status == InvoiceStatus.paid.value and invoice.status != InvoiceStatus.paid:
      balance = invoice_balance_due(invoice)
      if balance > 0:
        db.add(
          InvoicePayment(
            tenant_id=tenant_id,
            invoice_id=invoice.id,
            amount=float(balance),
            payment_date=date.today(),
            method="manual",
            reference="Marked paid",
          )
        )
        db.flush()
        db.refresh(invoice, attribute_names=["payments"])
      sync_invoice_status_from_payments(invoice)
    elif payload.status == InvoiceStatus.cancelled.value:
      invoice.status = InvoiceStatus.cancelled
    else:
      invoice.status = InvoiceStatus(payload.status)
  elif payload.lines is not None:
    sync_invoice_status_from_payments(invoice)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="update_invoice",
    entity_type="Invoice",
    entity_id=str(invoice.id),
    details=f"Updated invoice {invoice.invoice_number}",
    old_values=before,
    new_values={
      "customer_name": invoice.customer_name,
      "customer_email": invoice.customer_email,
      "issue_date": str(invoice.issue_date),
      "due_date": str(invoice.due_date) if invoice.due_date else None,
      "currency": invoice.currency,
      "vat_rate": float(invoice.vat_rate) if invoice.vat_rate is not None else None,
      "vat_country": invoice.vat_country,
      "notes": invoice.notes,
      "is_recurring": invoice.is_recurring,
      "recurring_interval_days": invoice.recurring_interval_days,
      "status": invoice.status.value,
      "subtotal": float(invoice.subtotal),
      "vat_amount": float(invoice.vat_amount),
      "total": float(invoice.total),
    },
  )

  db.commit()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  return _to_invoice_read(invoice)


@router.get("/{invoice_id}/payments", response_model=List[InvoicePaymentRead])
def list_invoice_payments(
  invoice_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  return [InvoicePaymentRead.model_validate(p) for p in (invoice.payments or [])]


@router.post("/{invoice_id}/payments", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def record_invoice_payment(
  invoice_id: int,
  payload: InvoicePaymentCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  if invoice.status == InvoiceStatus.cancelled:
    raise HTTPException(status_code=400, detail="Cannot record payment on a cancelled invoice")

  amount = Decimal(str(payload.amount))
  if amount <= 0:
    raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

  balance = invoice_balance_due(invoice)
  if amount > balance + Decimal("0.01"):
    raise HTTPException(
      status_code=400,
      detail=f"Payment exceeds balance due ({float(balance):.2f})",
    )

  payment = InvoicePayment(
    tenant_id=tenant_id,
    invoice_id=invoice.id,
    amount=float(amount),
    payment_date=payload.payment_date,
    method=(payload.method or None),
    reference=(payload.reference or None),
    notes=(payload.notes or None),
    bank_transaction_id=payload.bank_transaction_id,
  )
  db.add(payment)
  db.flush()
  db.refresh(invoice, attribute_names=["payments"])
  sync_invoice_status_from_payments(invoice)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="record_invoice_payment",
    entity_type="Invoice",
    entity_id=str(invoice.id),
    details=f"Recorded payment of {float(amount)} on invoice {invoice.invoice_number}",
    new_values={
      "payment_amount": float(amount),
      "payment_date": str(payload.payment_date),
      "method": payload.method,
      "status": invoice.status.value,
    },
  )
  db.commit()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  return _to_invoice_read(invoice)


@router.delete("/{invoice_id}/payments/{payment_id}", response_model=InvoiceRead)
def delete_invoice_payment(
  invoice_id: int,
  payment_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  payment = (
    db.query(InvoicePayment)
    .filter(
      InvoicePayment.id == payment_id,
      InvoicePayment.invoice_id == invoice_id,
      InvoicePayment.tenant_id == tenant_id,
    )
    .first()
  )
  if not payment:
    raise HTTPException(status_code=404, detail="Payment not found")

  amount = float(payment.amount or 0)
  db.delete(payment)
  db.flush()
  db.expire(invoice, ["payments"])
  db.refresh(invoice, attribute_names=["payments"])
  sync_invoice_status_from_payments(invoice)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="delete_invoice_payment",
    entity_type="Invoice",
    entity_id=str(invoice.id),
    details=f"Deleted payment of {amount} on invoice {invoice.invoice_number}",
    old_values={"payment_id": payment_id, "amount": amount},
    new_values={"status": invoice.status.value},
  )
  db.commit()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  return _to_invoice_read(invoice)


@router.post("/{invoice_id}/duplicate", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def duplicate_invoice(
  invoice_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  """Create a new draft invoice with the same customer, lines, and settings as the given invoice. Invoice number and issue/due dates are regenerated."""
  tenant_id = _get_tenant_id_or_400()
  invoice = (
    db.query(Invoice)
    .filter(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    .first()
  )
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  current_max = db.query(func.max(Invoice.invoice_number)).filter(Invoice.tenant_id == tenant_id).scalar()
  doc_number = (current_max or 0) + 1

  new_inv = Invoice(
    uuid=str(uuid_mod.uuid4()),
    tenant_id=tenant_id,
    customer_id=invoice.customer_id,
    invoice_number=doc_number,
    customer_name=invoice.customer_name,
    customer_email=invoice.customer_email,
    issue_date=invoice.issue_date,
    due_date=invoice.due_date,
    currency=invoice.currency,
    vat_rate=invoice.vat_rate,
    vat_country=invoice.vat_country,
    notes=invoice.notes,
    status=InvoiceStatus.draft,
    is_recurring=invoice.is_recurring,
    recurring_interval_days=invoice.recurring_interval_days,
    subtotal=invoice.subtotal,
    discount_type=invoice.discount_type,
    discount_percent=invoice.discount_percent,
    discount_amount=invoice.discount_amount or 0,
    vat_amount=invoice.vat_amount,
    total=invoice.total,
  )
  db.add(new_inv)
  db.flush()

  for line in invoice.lines:
    line_total = float(line.quantity) * float(line.unit_price)
    new_line = InvoiceLine(
      tenant_id=tenant_id,
      invoice_id=new_inv.id,
      description=line.description,
      quantity=line.quantity,
      unit_price=line.unit_price,
      vat_rate=line.vat_rate,
      line_total=line_total,
    )
    db.add(new_line)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="duplicate_invoice",
    entity_type="Invoice",
    entity_id=str(new_inv.id),
    details=f"Duplicated invoice {invoice.invoice_number} as {new_inv.invoice_number}",
    new_values={"invoice_number": new_inv.invoice_number, "source_invoice_id": invoice.id},
  )

  db.commit()
  new_inv = _load_invoice(db, tenant_id, new_inv.id)
  return _to_invoice_read(new_inv)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
  invoice_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = (
    db.query(Invoice)
    .filter(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    .first()
  )
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  before = {
    "invoice_number": invoice.invoice_number,
    "customer_name": invoice.customer_name,
    "total": float(invoice.total),
    "status": invoice.status.value,
  }

  db.delete(invoice)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="delete_invoice",
    entity_type="Invoice",
    entity_id=str(invoice.id),
    details=f"Deleted invoice {invoice.invoice_number}",
    old_values=before,
    new_values=None,
  )

  db.commit()
  return None


def _invoice_to_html(invoice: Invoice, theme: str, doctype: str, tenant: Tenant | None, db: Session | None = None) -> str:
  lines_data = [
    {
      "description": line.description,
      "quantity": float(line.quantity),
      "unit_price": float(line.unit_price),
      "line_total": float(line.line_total),
    }
    for line in invoice.lines
  ]
  payments_data = [
    {
      "payment_date": p.payment_date,
      "amount": float(p.amount or 0),
      "method": p.method,
      "reference": p.reference,
    }
    for p in (invoice.payments or [])
  ]
  paid = float(invoice_amount_paid(invoice))
  balance = float(invoice_balance_due(invoice))
  company_name = tenant.name if tenant else "Your Company"
  company_logo_url = getattr(tenant, "logo_url", None) if tenant else None
  company_address = getattr(tenant, "address", None) if tenant else None
  footer_text = getattr(tenant, "footer_text", None) if tenant else None
  bank_name = getattr(tenant, "bank_name", None) if tenant else None
  bank_account_number = getattr(tenant, "bank_account_number", None) if tenant else None
  bank_branch_code = getattr(tenant, "bank_branch_code", None) if tenant else None
  primary_color = getattr(tenant, "primary_color", None) if tenant else None
  secondary_color = getattr(tenant, "secondary_color", None) if tenant else None
  cust = None
  if db is not None and invoice.customer_id:
    cust = (
      db.query(Customer)
      .filter(Customer.id == invoice.customer_id, Customer.tenant_id == invoice.tenant_id)
      .first()
    )
  return build_invoice_html(
    title="",
    doc_number=invoice.invoice_number,
    customer_name=invoice.customer_name,
    customer_email=invoice.customer_email,
    issue_date=invoice.issue_date,
    due_date=invoice.due_date,
    currency=invoice.currency or "ZAR",
    subtotal=float(invoice.subtotal or 0),
    discount_amount=float(invoice.discount_amount or 0),
    discount_percent=float(invoice.discount_percent) if invoice.discount_percent is not None else None,
    vat_amount=float(invoice.vat_amount or 0),
    total=float(invoice.total or 0),
    vat_rate=float(invoice.vat_rate) if invoice.vat_rate is not None else None,
    vat_country=invoice.vat_country,
    notes=invoice.notes,
    lines=lines_data,
    theme=theme if theme in ("classic", "modern", "minimal", "elegant", "bold", "professional") else "classic",
    doctype=doctype if doctype in ("invoice", "quotation") else "invoice",
    company_name=company_name,
    company_logo_url=company_logo_url,
    company_address=company_address,
    footer_text=footer_text,
    bank_name=bank_name,
    bank_account_number=bank_account_number,
    bank_branch_code=bank_branch_code,
    primary_color=primary_color,
    secondary_color=secondary_color,
    amount_paid=paid,
    balance_due=balance,
    payments=payments_data,
    customer_phone=getattr(cust, "phone", None) if cust else None,
    customer_billing_address=getattr(cust, "address", None) if cust else None,
    customer_contact_name=getattr(cust, "contact_name", None) if cust else None,
    customer_registration_number=getattr(cust, "registration_number", None) if cust else None,
    customer_vat_number=getattr(cust, "vat_number", None) if cust else None,
    customer_id_number=getattr(cust, "id_number", None) if cust else None,
  )


@router.get("/{invoice_id}/html", response_class=HTMLResponse)
def view_invoice_html(
  invoice_id: int,
  theme: Literal["classic", "modern", "minimal", "elegant", "bold", "professional"] = "classic",
  doctype: Literal["invoice", "quotation"] = "invoice",
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  """Return HTML for the given invoice/quotation so it can be viewed in the browser without downloading PDF."""
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  html = _invoice_to_html(invoice, theme, doctype, tenant, db)
  return HTMLResponse(html)


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
  invoice_id: int,
  theme: Literal["classic", "modern", "minimal", "elegant", "bold", "professional"] = "classic",
  doctype: Literal["invoice", "quotation"] = "invoice",
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  html = _invoice_to_html(invoice, theme, doctype, tenant, db)
  pdf_bytes = _render_invoice_pdf(html)
  label = "quotation" if doctype == "quotation" else "invoice"
  headers = {"Content-Disposition": f'inline; filename="{label}-{invoice.invoice_number}.pdf"'}
  return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf", headers=headers)


class InvoiceEmailRequest(BaseModel):
  to_email: str | None = None  # override; otherwise invoice.customer_email
  theme: Literal["classic", "modern", "minimal", "elegant", "bold", "professional"] = "classic"
  doctype: Literal["invoice", "quotation"] = "invoice"


@router.post("/{invoice_id}/email")
def email_invoice(
  invoice_id: int,
  payload: InvoiceEmailRequest,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoice = _load_invoice(db, tenant_id, invoice_id)
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  to_email = (payload.to_email or invoice.customer_email or "").strip()
  if not to_email:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="No email address: set customer email on the invoice or provide to_email",
    )
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  html = _invoice_to_html(invoice, payload.theme, payload.doctype, tenant, db)
  pdf_bytes = _render_invoice_pdf(html)
  # Send email (stub: in production use SMTP or SendGrid etc.)
  try:
    from app.utils.email_sender import send_invoice_email
    send_invoice_email(to_email=to_email, invoice_number=invoice.invoice_number, pdf_bytes=pdf_bytes, doctype=payload.doctype)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
      detail="Email could not be sent. Please try again later.",
    )

  return {"ok": True, "message": f"Sent to {to_email}"}


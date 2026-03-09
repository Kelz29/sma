import uuid as uuid_mod
from datetime import date
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.accounting import Customer, Invoice, InvoiceLine, InvoiceStatus
from app.db.models.tenant import Tenant
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.accounting import (
  InvoiceCreate,
  InvoiceRead,
  InvoiceUpdate,
)
from app.utils.audit import log_audit
from app.utils.invoice_html import build_invoice_html

router = APIRouter(tags=["invoices"])


def _render_invoice_pdf(html_body: str) -> bytes:
  from app.utils.pdf import render_invoice_pdf
  return render_invoice_pdf(html_body=html_body)


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


def _calculate_totals(lines_data):
  subtotal = 0
  vat_amount = 0
  for line in lines_data:
    line_total = float(line.quantity) * float(line.unit_price)
    subtotal += line_total
    if line.vat_rate is not None:
      vat_amount += line_total * float(line.vat_rate) / 100.0
  total = subtotal + vat_amount
  return subtotal, vat_amount, total


@router.get("/", response_model=List[InvoiceRead])
def list_invoices(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  invoices = (
    db.query(Invoice)
    .filter(Invoice.tenant_id == tenant_id)
    .order_by(Invoice.issue_date.desc(), Invoice.invoice_number.desc())
    .all()
  )
  return invoices


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
  subtotal, vat_amount, total = _calculate_totals(payload.lines)

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
  return invoice


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(
  invoice_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
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
    "customer_name": invoice.customer_name,
    "customer_email": invoice.customer_email,
    "issue_date": str(invoice.issue_date),
    "due_date": str(invoice.due_date) if invoice.due_date else None,
    "vat_rate": float(invoice.vat_rate) if invoice.vat_rate is not None else None,
    "vat_country": invoice.vat_country,
    "notes": invoice.notes,
    "is_recurring": invoice.is_recurring,
    "recurring_interval_days": invoice.recurring_interval_days,
    "status": invoice.status.value,
  }
  return invoice


@router.put("/{invoice_id}", response_model=InvoiceRead)
def update_invoice(
  invoice_id: int,
  payload: InvoiceUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
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
  if payload.lines is not None:
    # Recalculate totals and replace line items
    from app.db.models.accounting import InvoiceLine

    subtotal, vat_amount, total = _calculate_totals(payload.lines)
    invoice.subtotal = subtotal
    invoice.vat_amount = vat_amount
    invoice.total = total

    # Remove existing lines for this invoice
    db.query(InvoiceLine).filter(
      InvoiceLine.tenant_id == tenant_id,
      InvoiceLine.invoice_id == invoice.id,
    ).delete()

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

  if payload.status is not None:
    if payload.status not in {s.value for s in InvoiceStatus}:
      raise HTTPException(status_code=400, detail="Invalid invoice status")
    invoice.status = InvoiceStatus(payload.status)

  db.add(invoice)

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
  db.refresh(invoice)
  return invoice


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
  db.refresh(new_inv)
  return new_inv


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


def _invoice_to_html(invoice: Invoice, theme: str, doctype: str, tenant: Tenant | None) -> str:
  lines_data = [
    {
      "description": line.description,
      "quantity": float(line.quantity),
      "unit_price": float(line.unit_price),
      "line_total": float(line.line_total),
    }
    for line in invoice.lines
  ]
  company_name = tenant.name if tenant else "Your Company"
  company_logo_url = getattr(tenant, "logo_url", None) if tenant else None
  company_address = getattr(tenant, "address", None) if tenant else None
  footer_text = getattr(tenant, "footer_text", None) if tenant else None
  bank_name = getattr(tenant, "bank_name", None) if tenant else None
  bank_account_number = getattr(tenant, "bank_account_number", None) if tenant else None
  bank_branch_code = getattr(tenant, "bank_branch_code", None) if tenant else None
  primary_color = getattr(tenant, "primary_color", None) if tenant else None
  secondary_color = getattr(tenant, "secondary_color", None) if tenant else None
  return build_invoice_html(
    title="",
    doc_number=invoice.invoice_number,
    customer_name=invoice.customer_name,
    customer_email=invoice.customer_email,
    issue_date=invoice.issue_date,
    due_date=invoice.due_date,
    currency=invoice.currency or "ZAR",
    subtotal=float(invoice.subtotal or 0),
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
  invoice = (
    db.query(Invoice)
    .filter(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    .first()
  )
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  html = _invoice_to_html(invoice, theme, doctype, tenant)
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
  invoice = (
    db.query(Invoice)
    .filter(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    .first()
  )
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  html = _invoice_to_html(invoice, theme, doctype, tenant)
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
  invoice = (
    db.query(Invoice)
    .filter(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    .first()
  )
  if not invoice:
    raise HTTPException(status_code=404, detail="Invoice not found")

  to_email = (payload.to_email or invoice.customer_email or "").strip()
  if not to_email:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="No email address: set customer email on the invoice or provide to_email",
    )
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  html = _invoice_to_html(invoice, payload.theme, payload.doctype, tenant)
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


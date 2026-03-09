from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.accounting import Customer, Invoice, InvoiceStatus
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.accounting import CustomerCreate, CustomerRead, CustomerUpdate

router = APIRouter(tags=["customers"])


class StatementLine(BaseModel):
  id: int
  invoice_number: int
  issue_date: str
  due_date: str | None
  total: float
  currency: str
  status: str

  class Config:
    from_attributes = True


class CustomerStatement(BaseModel):
  customer: CustomerRead
  invoices: List[StatementLine]
  total_invoiced: float
  total_paid: float
  total_outstanding: float
  currency: str


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("/", response_model=list[CustomerRead])
def list_customers(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  customers = (
    db.query(Customer)
    .filter(Customer.tenant_id == tenant_id)
    .order_by(Customer.name)
    .all()
  )
  return customers


@router.post("/", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
  payload: CustomerCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  customer = Customer(
    tenant_id=tenant_id,
    name=payload.name,
    email=payload.email,
    address=payload.address,
  )
  db.add(customer)
  db.commit()
  db.refresh(customer)
  return customer


@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(
  customer_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  customer = (
    db.query(Customer)
    .filter(Customer.tenant_id == tenant_id, Customer.id == customer_id)
    .first()
  )
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  return customer


@router.patch("/{customer_id}", response_model=CustomerRead)
def update_customer(
  customer_id: int,
  payload: CustomerUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  customer = (
    db.query(Customer)
    .filter(Customer.tenant_id == tenant_id, Customer.id == customer_id)
    .first()
  )
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  if payload.name is not None:
    customer.name = payload.name
  if payload.email is not None:
    customer.email = payload.email
  if payload.address is not None:
    customer.address = payload.address
  db.add(customer)
  db.commit()
  db.refresh(customer)
  return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
  customer_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  customer = (
    db.query(Customer)
    .filter(Customer.tenant_id == tenant_id, Customer.id == customer_id)
    .first()
  )
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")
  db.delete(customer)
  db.commit()
  return None


@router.get("/{customer_id}/statement", response_model=CustomerStatement)
def get_customer_statement(
  customer_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  """Return a statement for the customer: all their invoices with totals (invoiced, paid, outstanding)."""
  tenant_id = _get_tenant_id_or_400()
  customer = (
    db.query(Customer)
    .filter(Customer.tenant_id == tenant_id, Customer.id == customer_id)
    .first()
  )
  if not customer:
    raise HTTPException(status_code=404, detail="Customer not found")

  # Invoices that reference this customer by id or by name (for legacy one-off customers)
  invoices = (
    db.query(Invoice)
    .filter(
      Invoice.tenant_id == tenant_id,
      (Invoice.customer_id == customer_id) | (Invoice.customer_name == customer.name),
    )
    .order_by(Invoice.issue_date.desc(), Invoice.invoice_number.desc())
    .all()
  )

  total_invoiced = sum(float(inv.total or 0) for inv in invoices)
  total_paid = sum(float(inv.total or 0) for inv in invoices if inv.status == InvoiceStatus.paid)
  total_outstanding = total_invoiced - total_paid
  currency = invoices[0].currency if invoices else "ZAR"

  lines = [
    StatementLine(
      id=inv.id,
      invoice_number=inv.invoice_number,
      issue_date=str(inv.issue_date),
      due_date=str(inv.due_date) if inv.due_date else None,
      total=float(inv.total or 0),
      currency=inv.currency or "ZAR",
      status=inv.status.value,
    )
    for inv in invoices
  ]

  return CustomerStatement(
    customer=CustomerRead.model_validate(customer),
    invoices=lines,
    total_invoiced=round(total_invoiced, 2),
    total_paid=round(total_paid, 2),
    total_outstanding=round(total_outstanding, 2),
    currency=currency,
  )

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.accounting import Customer
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.accounting import CustomerCreate, CustomerRead

router = APIRouter(tags=["customers"])


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

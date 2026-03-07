"""Company branding and tenant user management for the current tenant."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.hr import Employee
from app.db.models.tenant import Tenant
from app.db.models.user import TenantUser, User
from app.middleware.tenant_context import get_current_tenant_id
from app.utils.password import get_password_hash

router = APIRouter(tags=["company"])


class CompanyRead(BaseModel):
  name: str
  logo_url: str | None
  address: str | None
  footer_text: str | None
  bank_name: str | None = None
  bank_account_number: str | None = None
  bank_branch_code: str | None = None
  primary_color: str | None = None
  secondary_color: str | None = None
  default_currency: str | None = None
  default_vat_rate: float | None = None
  default_vat_country: str | None = None


class CompanyUpdate(BaseModel):
  name: str | None = None
  logo_url: str | None = None
  address: str | None = None
  footer_text: str | None = None
  bank_name: str | None = None
  bank_account_number: str | None = None
  bank_branch_code: str | None = None
  primary_color: str | None = None
  secondary_color: str | None = None
  default_currency: str | None = None
  default_vat_rate: float | None = None
  default_vat_country: str | None = None


class CompanyUserRead(BaseModel):
  id: int
  user_id: int
  email: str
  full_name: str | None
  role: str
  is_owner: bool


class CompanyUserCreate(BaseModel):
  email: EmailStr
  full_name: str | None = None
  password: str
  role: str = "viewer"


class CompanyUserUpdate(BaseModel):
  role: str


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("", response_model=CompanyRead)
def get_company(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "hr", "viewer", "employee", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  if not tenant:
    raise HTTPException(status_code=404, detail="Tenant not found")
  return CompanyRead(
    name=tenant.name,
    logo_url=getattr(tenant, "logo_url", None),
    address=getattr(tenant, "address", None),
    footer_text=getattr(tenant, "footer_text", None),
    bank_name=getattr(tenant, "bank_name", None),
    bank_account_number=getattr(tenant, "bank_account_number", None),
    bank_branch_code=getattr(tenant, "bank_branch_code", None),
    primary_color=getattr(tenant, "primary_color", None),
    secondary_color=getattr(tenant, "secondary_color", None),
    default_currency=getattr(tenant, "default_currency", None),
    default_vat_rate=getattr(tenant, "default_vat_rate", None),
    default_vat_country=getattr(tenant, "default_vat_country", None),
  )


@router.patch("", response_model=CompanyRead)
def update_company(
  payload: CompanyUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin"])),
):
  tenant_id = _get_tenant_id_or_400()
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  if not tenant:
    raise HTTPException(status_code=404, detail="Tenant not found")
  if payload.name is not None:
    tenant.name = payload.name
  if payload.logo_url is not None:
    tenant.logo_url = payload.logo_url or None
  if payload.address is not None:
    tenant.address = payload.address or None
  if payload.footer_text is not None:
    tenant.footer_text = payload.footer_text or None
  if payload.bank_name is not None:
    tenant.bank_name = payload.bank_name or None
  if payload.bank_account_number is not None:
    tenant.bank_account_number = payload.bank_account_number or None
  if payload.bank_branch_code is not None:
    tenant.bank_branch_code = payload.bank_branch_code or None
  if payload.primary_color is not None:
    tenant.primary_color = payload.primary_color or None
  if payload.secondary_color is not None:
    tenant.secondary_color = payload.secondary_color or None
  if payload.default_currency is not None:
    tenant.default_currency = payload.default_currency or None
  if payload.default_vat_rate is not None:
    tenant.default_vat_rate = payload.default_vat_rate
  if payload.default_vat_country is not None:
    tenant.default_vat_country = payload.default_vat_country or None
  db.add(tenant)
  db.commit()
  db.refresh(tenant)
  return CompanyRead(
    name=tenant.name,
    logo_url=getattr(tenant, "logo_url", None),
    address=getattr(tenant, "address", None),
    footer_text=getattr(tenant, "footer_text", None),
    bank_name=getattr(tenant, "bank_name", None),
    bank_account_number=getattr(tenant, "bank_account_number", None),
    bank_branch_code=getattr(tenant, "bank_branch_code", None),
    primary_color=getattr(tenant, "primary_color", None),
    secondary_color=getattr(tenant, "secondary_color", None),
    default_currency=getattr(tenant, "default_currency", None),
    default_vat_rate=getattr(tenant, "default_vat_rate", None),
    default_vat_country=getattr(tenant, "default_vat_country", None),
  )


ALLOWED_ROLES = {"admin", "accountant", "hr", "viewer", "employee", "sales"}


@router.get("/users", response_model=list[CompanyUserRead])
def list_company_users(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin"])),
):
  """List all users in the current tenant. Company admin only."""
  tenant_id = _get_tenant_id_or_400()
  links = (
    db.query(TenantUser, User)
    .join(User, TenantUser.user_id == User.id)
    .filter(TenantUser.tenant_id == tenant_id)
    .all()
  )
  return [
    CompanyUserRead(
      id=tu.id,
      user_id=tu.user_id,
      email=u.email,
      full_name=u.full_name,
      role=tu.role,
      is_owner=tu.is_owner,
    )
    for tu, u in links
  ]


@router.post("/users", response_model=CompanyUserRead, status_code=status.HTTP_201_CREATED)
def create_company_user(
  payload: CompanyUserCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin"])),
):
  """Create a new user in the current tenant. Company admin only."""
  tenant_id = _get_tenant_id_or_400()
  if payload.role not in ALLOWED_ROLES:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=f"Role must be one of: {', '.join(sorted(ALLOWED_ROLES))}",
    )
  user = db.query(User).filter(User.email == payload.email).first()
  if user:
    existing = (
      db.query(TenantUser)
      .filter(TenantUser.tenant_id == tenant_id, TenantUser.user_id == user.id)
      .first()
    )
    if existing:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="User already exists in this company",
      )
  else:
    user = User(
      email=payload.email,
      full_name=payload.full_name,
      hashed_password=get_password_hash(payload.password),
      is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
  tenant_link = TenantUser(
    tenant_id=tenant_id,
    user_id=user.id,
    role=payload.role,
    is_owner=False,
  )
  db.add(tenant_link)
  db.commit()
  db.refresh(tenant_link)

  # Auto-create an Employee record for this user so they appear in HR and can use portal/payroll.
  existing_employee = (
    db.query(Employee)
    .filter(Employee.tenant_id == tenant_id, Employee.user_id == user.id)
    .first()
  )
  if not existing_employee:
    name_str = (payload.full_name or getattr(user, "full_name", None) or "").strip()
    parts = name_str.split(maxsplit=1)
    first_name = (parts[0] or user.email.split("@")[0] or "User").strip()[:255]
    last_name = (parts[1] if len(parts) > 1 else "").strip()[:255] or "—"
    employee_number = f"U{user.id}"
    emp = Employee(
      tenant_id=tenant_id,
      user_id=user.id,
      employee_number=employee_number,
      first_name=first_name,
      last_name=last_name,
      email=user.email,
      is_active=True,
    )
    db.add(emp)
    db.commit()

  return CompanyUserRead(
    id=tenant_link.id,
    user_id=user.id,
    email=user.email,
    full_name=user.full_name,
    role=tenant_link.role,
    is_owner=tenant_link.is_owner,
  )


@router.patch("/users/{tenant_user_id}", response_model=CompanyUserRead)
def update_company_user(
  tenant_user_id: int,
  payload: CompanyUserUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin"])),
):
  """Update a user's role in the current tenant. Company admin only. Cannot change owner."""
  tenant_id = _get_tenant_id_or_400()
  if payload.role not in ALLOWED_ROLES:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=f"Role must be one of: {', '.join(sorted(ALLOWED_ROLES))}",
    )
  link = (
    db.query(TenantUser)
    .filter(TenantUser.id == tenant_user_id, TenantUser.tenant_id == tenant_id)
    .first()
  )
  if not link:
    raise HTTPException(status_code=404, detail="User not found in this company")
  if link.is_owner:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Cannot change role of the company owner",
    )
  link.role = payload.role
  db.add(link)
  db.commit()
  db.refresh(link)
  user = db.query(User).filter(User.id == link.user_id).first()
  return CompanyUserRead(
    id=link.id,
    user_id=link.user_id,
    email=user.email,
    full_name=user.full_name,
    role=link.role,
    is_owner=link.is_owner,
  )


@router.delete("/users/{tenant_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_company_user(
  tenant_user_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin"])),
):
  """Remove a user from the current tenant. Company admin only. Cannot remove owner. Employee record is kept."""
  tenant_id = _get_tenant_id_or_400()
  link = (
    db.query(TenantUser)
    .filter(TenantUser.id == tenant_user_id, TenantUser.tenant_id == tenant_id)
    .first()
  )
  if not link:
    raise HTTPException(status_code=404, detail="User not found in this company")
  if link.is_owner:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Cannot remove the company owner",
    )
  db.delete(link)
  db.commit()
  return None

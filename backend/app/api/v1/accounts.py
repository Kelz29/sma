from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.accounting import Account, AccountCategory
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.accounting import (
  AccountCreate,
  AccountRead,
  AccountUpdate,
)
from app.utils.audit import log_audit

router = APIRouter(tags=["accounts"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("/", response_model=list[AccountRead])
def list_accounts(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  accounts = (
    db.query(Account)
    .filter(Account.tenant_id == tenant_id, Account.is_deleted.is_(False))
    .order_by(Account.code)
    .all()
  )
  return accounts


@router.post("/", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
def create_account(
  payload: AccountCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()

  # Basic validation: account code unique per tenant and category allowed
  if payload.category not in {c.value for c in AccountCategory}:
    raise HTTPException(status_code=400, detail="Invalid account category")

  existing = (
    db.query(Account)
    .filter(Account.tenant_id == tenant_id, Account.code == payload.code, Account.is_deleted.is_(False))
    .first()
  )
  if existing:
    raise HTTPException(status_code=400, detail="Account code already exists")

  if payload.parent_id:
    parent = (
      db.query(Account)
      .filter(Account.tenant_id == tenant_id, Account.id == payload.parent_id, Account.is_deleted.is_(False))
      .first()
    )
    if not parent:
      raise HTTPException(status_code=400, detail="Parent account not found")

  account = Account(
    tenant_id=tenant_id,
    code=payload.code,
    name=payload.name,
    category=AccountCategory(payload.category),
    parent_id=payload.parent_id,
    opening_debit=payload.opening_debit,
    opening_credit=payload.opening_credit,
    is_active=payload.is_active,
  )
  db.add(account)
  db.flush()

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="create_account",
    entity_type="Account",
    entity_id=str(account.id),
    details=f"Created account {account.code}",
    new_values={
      "code": account.code,
      "name": account.name,
      "category": account.category.value,
      "parent_id": account.parent_id,
      "opening_debit": float(account.opening_debit),
      "opening_credit": float(account.opening_credit),
      "is_active": account.is_active,
    },
  )
  db.commit()
  db.refresh(account)
  return account


@router.get("/{account_id}", response_model=AccountRead)
def get_account(
  account_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  account = (
    db.query(Account)
    .filter(Account.tenant_id == tenant_id, Account.id == account_id, Account.is_deleted.is_(False))
    .first()
  )
  if not account:
    raise HTTPException(status_code=404, detail="Account not found")
  return account


@router.put("/{account_id}", response_model=AccountRead)
def update_account(
  account_id: int,
  payload: AccountUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  account = (
    db.query(Account)
    .filter(Account.tenant_id == tenant_id, Account.id == account_id, Account.is_deleted.is_(False))
    .first()
  )
  if not account:
    raise HTTPException(status_code=404, detail="Account not found")

  before = {
    "name": account.name,
    "category": account.category.value,
    "parent_id": account.parent_id,
    "opening_debit": float(account.opening_debit),
    "opening_credit": float(account.opening_credit),
    "is_active": account.is_active,
    "is_deleted": account.is_deleted,
  }
  if payload.category and payload.category not in {c.value for c in AccountCategory}:
    raise HTTPException(status_code=400, detail="Invalid account category")

  if payload.name is not None:
    account.name = payload.name
  if payload.category is not None:
    account.category = AccountCategory(payload.category)
  if payload.parent_id is not None:
    if payload.parent_id == account.id:
      raise HTTPException(status_code=400, detail="Account cannot be its own parent")
    parent = (
      db.query(Account)
      .filter(Account.tenant_id == tenant_id, Account.id == payload.parent_id, Account.is_deleted.is_(False))
      .first()
    )
    if not parent:
      raise HTTPException(status_code=400, detail="Parent account not found")
    account.parent_id = payload.parent_id
  if payload.opening_debit is not None:
    account.opening_debit = payload.opening_debit
  if payload.opening_credit is not None:
    account.opening_credit = payload.opening_credit
  if payload.is_active is not None:
    account.is_active = payload.is_active
  if payload.is_deleted:
    account.is_deleted = True
    account.deleted_at = datetime.utcnow()

  db.add(account)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="update_account",
    entity_type="Account",
    entity_id=str(account.id),
    details=f"Updated account {account.code}",
    old_values=before,
    new_values={
      "name": account.name,
      "category": account.category.value,
      "parent_id": account.parent_id,
      "opening_debit": float(account.opening_debit),
      "opening_credit": float(account.opening_credit),
      "is_active": account.is_active,
      "is_deleted": account.is_deleted,
    },
  )

  db.commit()
  db.refresh(account)
  return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
  account_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin"])),
):
  tenant_id = _get_tenant_id_or_400()
  account = (
    db.query(Account)
    .filter(Account.tenant_id == tenant_id, Account.id == account_id, Account.is_deleted.is_(False))
    .first()
  )
  if not account:
    raise HTTPException(status_code=404, detail="Account not found")

  account.is_deleted = True
  account.deleted_at = datetime.utcnow()
  db.add(account)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="soft_delete_account",
    entity_type="Account",
    entity_id=str(account.id),
    details=f"Soft deleted account {account.code}",
  )

  db.commit()
  return None


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.security import create_access_token
from app.db.models.feature_flag import FEATURE_KEYS, FeatureFlag, ensure_defaults as ensure_feature_flags
from app.db.models.tenant import Tenant, TenantStatus
from app.db.models.user import TenantUser, User
from app.schemas.admin import (
  FeatureFlagRead,
  FeatureFlagUpdate,
  ResetPasswordRequest,
  SwitchTenantRequest,
  TenantStatusUpdate,
  TenantSummary,
  TenantUserInfo,
)
from app.schemas.auth import Token
from app.utils.password import get_password_hash


router = APIRouter(tags=["admin"])


@router.post("/switch-tenant", response_model=Token)
def switch_tenant(
  payload: SwitchTenantRequest,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  """
  Switch the current tenant context. Superadmin only.
  Returns a new access token for the selected tenant so the superadmin can view that company's data.
  """
  tenant = db.query(Tenant).filter(Tenant.id == payload.tenant_id).first()
  if not tenant:
    raise HTTPException(status_code=404, detail="Tenant not found")
  if tenant.status == TenantStatus.suspended:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant is suspended")
  user = ctx["user"]
  access_token = create_access_token(
    subject=str(user.id),
    tenant_id=tenant.id,
    role="superadmin",
  )
  return Token(access_token=access_token)


@router.get("/tenants", response_model=list[TenantSummary])
def list_tenants(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  """
  List all tenants in the system.

  This endpoint is restricted to users with the `superadmin` role. It is
  intended to power a superadmin view in the frontend where global admins
  can see and manage all businesses / tenants.
  """
  tenants = db.query(Tenant).order_by(Tenant.name).all()
  return tenants


@router.patch("/tenants/{tenant_id}", response_model=TenantSummary)
def update_tenant_status(
  tenant_id: int,
  payload: TenantStatusUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  """Update a tenant's status (active/suspended). Superadmin only."""
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  if not tenant:
    raise HTTPException(status_code=404, detail="Tenant not found")
  tenant.status = TenantStatus(payload.status)
  db.add(tenant)
  db.commit()
  db.refresh(tenant)
  return tenant


@router.get("/tenants/{tenant_id}/users", response_model=list[TenantUserInfo])
def list_tenant_users(
  tenant_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  """List all users linked to a tenant. Superadmin only."""
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  if not tenant:
    raise HTTPException(status_code=404, detail="Tenant not found")
  links = (
    db.query(TenantUser, User)
    .join(User, TenantUser.user_id == User.id)
    .filter(TenantUser.tenant_id == tenant_id)
    .all()
  )
  return [
    TenantUserInfo(
      id=tu.id,
      user_id=tu.user_id,
      email=u.email,
      full_name=u.full_name,
      role=tu.role,
      is_owner=tu.is_owner,
    )
    for tu, u in links
  ]


@router.post("/reset-password")
def reset_user_password(
  payload: ResetPasswordRequest,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  """
  Set a new password for a user in a specific tenant. Superadmin only.
  Used to help company admins regain access.
  """
  link = (
    db.query(TenantUser)
    .filter(
      TenantUser.tenant_id == payload.tenant_id,
      TenantUser.user_id == payload.user_id,
    )
    .first()
  )
  if not link:
    raise HTTPException(status_code=404, detail="User not found in this tenant")
  user = db.query(User).filter(User.id == payload.user_id).first()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")
  user.hashed_password = get_password_hash(payload.new_password)
  db.add(user)
  db.commit()
  return {"detail": "Password updated"}


@router.get("/feature-flags", response_model=list[FeatureFlagRead])
def list_feature_flags(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  """List all feature flags. Superadmin only. Used to toggle features on/off."""
  ensure_feature_flags(db)
  rows = db.query(FeatureFlag).filter(FeatureFlag.key.in_(FEATURE_KEYS)).order_by(FeatureFlag.key).all()
  return rows


@router.patch("/feature-flags/{key}", response_model=FeatureFlagRead)
def update_feature_flag(
  key: str,
  payload: FeatureFlagUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  """Enable or disable a platform feature. Superadmin only."""
  ensure_feature_flags(db)
  row = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
  if not row:
    raise HTTPException(status_code=404, detail="Unknown feature key")
  row.enabled = payload.enabled
  db.add(row)
  db.commit()
  db.refresh(row)
  return row


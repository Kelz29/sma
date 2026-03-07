from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.models.user import User, TenantUser
from app.db.session import SessionLocal
from app.middleware.tenant_context import get_current_tenant_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()


def get_current_user(
  token: str = Depends(oauth2_scheme),
  db: Session = Depends(get_db),
):
  payload = decode_token(token)
  if not payload:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

  user_id = int(payload.get("sub"))
  tenant_id_from_token = int(payload.get("tenant_id"))
  tenant_id_context = get_current_tenant_id()
  if not tenant_id_context or tenant_id_context != tenant_id_from_token:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant mismatch")

  user = db.query(User).filter(User.id == user_id).first()
  if not user or not user.is_active:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")

  tenant_user = (
    db.query(TenantUser)
    .filter(
      TenantUser.user_id == user.id,
      TenantUser.tenant_id == tenant_id_from_token,
    )
    .first()
  )
  if not tenant_user:
    # Superadmin may switch to any tenant to view company data; allow with synthetic context
    is_superadmin = (
      db.query(TenantUser)
      .filter(TenantUser.user_id == user.id, TenantUser.role == "superadmin")
      .first()
      is not None
    )
    if not is_superadmin:
      raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not in tenant")
    from types import SimpleNamespace
    tenant_user = SimpleNamespace(role="superadmin", tenant_id=tenant_id_from_token, is_owner=False)

  return {"user": user, "tenant_user": tenant_user}


def require_role(required_roles: list[str]):
  """
  Enforce that the current tenant role is in the allowed list.

  A user with the special `superadmin` role is always allowed, regardless of
  the `required_roles` configuration. This lets superadmins access any
  tenant-scoped endpoint without having to list the role everywhere.
  """

  def _role_checker(context=Depends(get_current_user)):
    role = context["tenant_user"].role

    # Superadmins are allowed to access any endpoint that uses role checks.
    if role == "superadmin":
      return context

    if role not in required_roles:
      raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient role",
      )
    return context

  return _role_checker


def get_current_employee(context=Depends(get_current_user), db: Session = Depends(get_db)):
  """
  Resolve the Employee record for the current user. Only valid when the user
  has role "employee"; the employee is the one linked to this user in this tenant.
  """
  from app.db.models.hr import Employee

  role = context["tenant_user"].role
  if role != "employee":
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee access only")

  tenant_id = context["tenant_user"].tenant_id
  user_id = context["user"].id
  employee = (
    db.query(Employee)
    .filter(Employee.tenant_id == tenant_id, Employee.user_id == user_id)
    .first()
  )
  if not employee:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="No employee profile linked to this account",
    )
  return employee


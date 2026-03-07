import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.db.models.tenant import Tenant, TenantStatus
from app.db.models.user import TenantUser, User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, MeResponse, MeUpdate, RegisterRequest, Token
from app.utils.password import get_password_hash, verify_password

router = APIRouter(tags=["auth"])

ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
AVATAR_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}


@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: Session = Depends(get_db)):
  tenant = db.query(Tenant).filter(Tenant.slug == data.tenant_slug).first()
  if not tenant:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tenant")
  if tenant.status == TenantStatus.suspended:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Tenant is suspended. Contact support.",
    )

  user = db.query(User).filter(User.email == data.email).first()
  if not user or not verify_password(data.password, user.hashed_password):
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid credentials")

  tenant_link = (
    db.query(TenantUser)
    .filter(TenantUser.user_id == user.id, TenantUser.tenant_id == tenant.id)
    .first()
  )
  if not tenant_link:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not in tenant")

  access_token = create_access_token(
    subject=str(user.id),
    tenant_id=tenant.id,
    role=tenant_link.role,
  )
  return Token(access_token=access_token)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
  """
  Register a new user and tenant (or join an existing tenant).

  - If the tenant slug does not exist, create a new tenant and make the user
    the owner with the `admin` role.
  - If the tenant slug exists and the user does not, create the user and link
    them to the tenant (first user becomes `admin`, subsequent users default
    to `viewer`).
  """

  tenant = db.query(Tenant).filter(Tenant.slug == data.tenant_slug).first()
  if not tenant:
    tenant = Tenant(name=data.tenant_name, slug=data.tenant_slug)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

  user = db.query(User).filter(User.email == data.email).first()
  if user:
    # If the user already exists and is already linked to this tenant, prevent duplicate registration.
    existing_link = (
      db.query(TenantUser)
      .filter(TenantUser.user_id == user.id, TenantUser.tenant_id == tenant.id)
      .first()
    )
    if existing_link:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="User already registered for this tenant",
      )
  else:
    user = User(
      email=data.email,
      full_name=data.full_name,
      hashed_password=get_password_hash(data.password),
      is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

  # Decide role: first user in tenant becomes admin/owner, others default to viewer.
  existing_tenant_users = db.query(TenantUser).filter(TenantUser.tenant_id == tenant.id).all()
  if not existing_tenant_users:
    role = "admin"
    is_owner = True
  else:
    role = "viewer"
    is_owner = False

  tenant_link = TenantUser(
    tenant_id=tenant.id,
    user_id=user.id,
    role=role,
    is_owner=is_owner,
  )
  db.add(tenant_link)
  db.commit()

  access_token = create_access_token(
    subject=str(user.id),
    tenant_id=tenant.id,
    role=role,
  )
  return Token(access_token=access_token)


@router.get("/me", response_model=MeResponse)
def read_me(context=Depends(get_current_user)):
  """
  Return basic information about the currently authenticated user in
  the active tenant, including their role. This is useful for wiring
  up the frontend auth store and role-based views (e.g. superadmin).
  """

  user: User = context["user"]
  tenant_user: TenantUser = context["tenant_user"]

  return MeResponse(
    id=user.id,
    email=user.email,
    full_name=user.full_name,
    role=tenant_user.role,
    tenant_id=tenant_user.tenant_id,
    is_owner=tenant_user.is_owner,
    avatar_url=getattr(user, "avatar_url", None),
  )


@router.patch("/me", response_model=MeResponse)
def update_me(
  payload: MeUpdate,
  db: Session = Depends(get_db),
  context=Depends(get_current_user),
):
  """Update the current user's profile (full_name, email)."""
  user: User = context["user"]
  if payload.full_name is not None:
    user.full_name = payload.full_name.strip() or None
  if payload.email is not None:
    user.email = payload.email.strip()
  db.add(user)
  db.commit()
  db.refresh(user)
  tenant_user: TenantUser = context["tenant_user"]
  return MeResponse(
    id=user.id,
    email=user.email,
    full_name=user.full_name,
    role=tenant_user.role,
    tenant_id=tenant_user.tenant_id,
    is_owner=tenant_user.is_owner,
    avatar_url=getattr(user, "avatar_url", None),
  )


@router.post("/me/avatar", response_model=MeResponse)
def upload_avatar(
  file: UploadFile = File(...),
  db: Session = Depends(get_db),
  context=Depends(get_current_user),
):
  """Upload a profile picture. Replaces existing avatar. Allowed: JPEG, PNG, GIF, WebP; max 2 MB."""
  user: User = context["user"]
  content_type = (file.content_type or "").strip().lower()
  if content_type not in ALLOWED_AVATAR_TYPES:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Allowed types: JPEG, PNG, GIF, WebP",
    )
  content = file.file.read()
  if len(content) > settings.AVATAR_MAX_BYTES:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=f"File too large. Max {settings.AVATAR_MAX_BYTES // (1024 * 1024)} MB.",
    )
  upload_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
  os.makedirs(upload_dir, exist_ok=True)
  ext = AVATAR_EXT.get(content_type, ".jpg")
  filename = f"{user.id}_{uuid.uuid4().hex[:8]}{ext}"
  filepath = os.path.join(upload_dir, filename)
  with open(filepath, "wb") as f:
    f.write(content)
  relative_url = f"/uploads/avatars/{filename}"
  user.avatar_url = relative_url
  db.add(user)
  db.commit()
  db.refresh(user)
  tenant_user: TenantUser = context["tenant_user"]
  return MeResponse(
    id=user.id,
    email=user.email,
    full_name=user.full_name,
    role=tenant_user.role,
    tenant_id=tenant_user.tenant_id,
    is_owner=tenant_user.is_owner,
    avatar_url=user.avatar_url,
  )


@router.post("/change-password")
def change_password(
  payload: ChangePasswordRequest,
  db: Session = Depends(get_db),
  context=Depends(get_current_user),
):
  """Change the current user's password. Requires current password."""
  user: User = context["user"]
  if not verify_password(payload.current_password, user.hashed_password):
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
  user.hashed_password = get_password_hash(payload.new_password)
  db.add(user)
  db.commit()
  return {"detail": "Password updated"}


import re
from pydantic import BaseModel, field_validator

from app.db.models.tenant import TenantStatus


class TenantSummary(BaseModel):
  id: int
  name: str
  slug: str
  status: TenantStatus

  class Config:
    from_attributes = True


class SwitchTenantRequest(BaseModel):
  tenant_id: int


class TenantStatusUpdate(BaseModel):
  status: TenantStatus


class TenantUserInfo(BaseModel):
  id: int
  user_id: int
  email: str
  full_name: str | None
  role: str
  is_owner: bool

  class Config:
    from_attributes = True


class ResetPasswordRequest(BaseModel):
  tenant_id: int
  user_id: int
  new_password: str

  @field_validator("new_password")
  @classmethod
  def validate_new_password(cls, v: str) -> str:
    if len(v) < 8:
      raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[a-zA-Z]", v):
      raise ValueError("Password must contain at least one letter")
    if not re.search(r"\d", v):
      raise ValueError("Password must contain at least one number")
    return v


class FeatureFlagRead(BaseModel):
  key: str
  enabled: bool
  description: str | None = None

  class Config:
    from_attributes = True


class FeatureFlagUpdate(BaseModel):
  enabled: bool


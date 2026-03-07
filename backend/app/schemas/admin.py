from pydantic import BaseModel

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


class FeatureFlagRead(BaseModel):
  key: str
  enabled: bool
  description: str | None = None

  class Config:
    from_attributes = True


class FeatureFlagUpdate(BaseModel):
  enabled: bool


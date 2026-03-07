from pydantic import BaseModel, EmailStr


class Token(BaseModel):
  access_token: str
  token_type: str = "bearer"


class LoginRequest(BaseModel):
  email: EmailStr
  password: str
  tenant_slug: str


class RegisterRequest(BaseModel):
  email: EmailStr
  password: str
  full_name: str | None = None
  tenant_name: str
  tenant_slug: str


class MeResponse(BaseModel):
  id: int
  email: EmailStr
  full_name: str | None = None
  role: str
  tenant_id: int
  is_owner: bool
  avatar_url: str | None = None


class MeUpdate(BaseModel):
  full_name: str | None = None
  email: EmailStr | None = None


class ChangePasswordRequest(BaseModel):
  current_password: str
  new_password: str


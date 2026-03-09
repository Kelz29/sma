import re
from pydantic import BaseModel, EmailStr, field_validator


def _password_complexity(v: str) -> str:
  if len(v) < 8:
    raise ValueError("Password must be at least 8 characters")
  if not re.search(r"[a-zA-Z]", v):
    raise ValueError("Password must contain at least one letter")
  if not re.search(r"\d", v):
    raise ValueError("Password must contain at least one number")
  return v


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

  @field_validator("password")
  @classmethod
  def validate_password(cls, v: str) -> str:
    return _password_complexity(v)


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

  @field_validator("new_password")
  @classmethod
  def validate_new_password(cls, v: str) -> str:
    return _password_complexity(v)


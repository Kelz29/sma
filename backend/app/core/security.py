from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"


def create_access_token(subject: str, tenant_id: int, role: str, expires_minutes: int | None = None) -> str:
  if expires_minutes is None:
    expires_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
  expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
  to_encode: dict[str, Any] = {
    "sub": subject,
    "tenant_id": tenant_id,
    "role": role,
    "exp": expire,
  }
  return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict[str, Any]]:
  try:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    return payload
  except JWTError:
    return None


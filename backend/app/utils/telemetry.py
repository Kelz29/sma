"""Write usage events. Callers never pass request bodies."""

from datetime import datetime, timedelta

from fastapi import Request

from app.core.security import decode_token
from app.db.models.usage import UsageEvent
from app.db.session import SessionLocal

MESSAGE_MAX = 500
STACK_MAX = 2000
PATH_MAX = 255
RETENTION_DAYS = 90
CLIENT_ACTION = "pdf_editor_download"


def clean_path(path: str) -> str:
  raw = (path or "").split("?", 1)[0].split("#", 1)[0].strip() or "/"
  if not raw.startswith("/"):
    raw = "/" + raw
  return raw[:PATH_MAX]


def _clip(value: str | None, limit: int) -> str | None:
  if value is None:
    return None
  text = value.strip()
  if not text:
    return None
  return text[:limit]


def record_event(
  *,
  kind: str,
  path: str,
  action: str | None = None,
  method: str | None = None,
  status_code: int | None = None,
  message: str | None = None,
  stack: str | None = None,
  user_id: int | None = None,
  tenant_id: int | None = None,
  role: str | None = None,
) -> None:
  """Persist one event on its own session so a product request is not rolled back."""
  db = SessionLocal()
  try:
    cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
    db.query(UsageEvent).filter(UsageEvent.created_at < cutoff).delete(synchronize_session=False)
    db.add(
      UsageEvent(
        kind=kind,
        path=clean_path(path),
        action=(action or None),
        method=(method or None),
        status_code=status_code,
        message=_clip(message, MESSAGE_MAX),
        stack=_clip(stack, STACK_MAX),
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
        created_at=datetime.utcnow(),
      )
    )
    db.commit()
  except Exception:
    db.rollback()
  finally:
    db.close()


def record_action(
  *,
  action: str,
  path: str,
  user_id: int | None,
  tenant_id: int | None,
  role: str | None,
) -> None:
  record_event(
    kind="action",
    path=path,
    action=action,
    user_id=user_id,
    tenant_id=tenant_id,
    role=role,
  )


def _identity(request: Request) -> tuple[int | None, int | None, str | None]:
  header = request.headers.get("authorization") or ""
  if not header.lower().startswith("bearer "):
    return None, None, None
  payload = decode_token(header.split(" ", 1)[1].strip())
  if not payload:
    return None, None, None
  try:
    user_id = int(payload.get("sub"))
    tenant_id = int(payload.get("tenant_id"))
  except (TypeError, ValueError):
    return None, None, None
  role = payload.get("role")
  return user_id, tenant_id, str(role) if role else None


def note_api_error(request: Request, status_code: int) -> None:
  """Record an HTTP 500. The request body is never read."""
  if status_code < 500:
    return
  if getattr(request.state, "usage_api_error_recorded", False):
    return
  path = request.url.path
  if path in ("/health", "/metrics") or "/telemetry" in path:
    return
  request.state.usage_api_error_recorded = True
  user_id, tenant_id, role = _identity(request)
  record_event(
    kind="api_error",
    path=path,
    method=request.method,
    status_code=status_code,
    user_id=user_id,
    tenant_id=tenant_id,
    role=role,
  )

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.tenant import Tenant
from app.db.models.usage import UsageEvent
from app.db.models.user import User
from app.schemas.telemetry import TelemetryEventCreate, UsageEventRead, UsageSummary
from app.services.usage_insights import build_summary
from app.utils.rate_limit import check_rate_limit
from app.utils.telemetry import CLIENT_ACTION, record_event

router = APIRouter(tags=["telemetry"])
admin_router = APIRouter(tags=["telemetry"])


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
def create_telemetry_event(
  payload: TelemetryEventCreate,
  ctx=Depends(deps.get_current_user),
):
  """Signed-in clients report page views, editor downloads, and browser errors."""
  user = ctx["user"]
  limited = check_rate_limit("telemetry", str(user.id), max_per_window=120, window_sec=60)
  if limited:
    raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=limited)
  action = None
  message = None
  stack = None
  if payload.kind == "action":
    if payload.action != CLIENT_ACTION:
      raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown action")
    action = CLIENT_ACTION
  elif payload.kind == "client_error":
    message = payload.message
    stack = payload.stack
  record_event(
    kind=payload.kind,
    path=payload.path,
    action=action,
    message=message,
    stack=stack,
    user_id=user.id,
    tenant_id=ctx["tenant_user"].tenant_id,
    role=ctx["tenant_user"].role,
  )
  return None


@admin_router.get("/telemetry/summary", response_model=UsageSummary)
def telemetry_summary(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
):
  return build_summary(db)


@admin_router.get("/telemetry/events", response_model=list[UsageEventRead])
def telemetry_events(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["superadmin"])),
  limit: int = 100,
):
  limit = max(1, min(limit, 200))
  rows = (
    db.query(UsageEvent)
    .order_by(UsageEvent.created_at.desc(), UsageEvent.id.desc())
    .limit(limit)
    .all()
  )
  user_ids = {row.user_id for row in rows if row.user_id is not None}
  tenant_ids = {row.tenant_id for row in rows if row.tenant_id is not None}
  emails = {
    user.id: user.email
    for user in db.query(User).filter(User.id.in_(user_ids or {0})).all()
  }
  names = {
    tenant.id: tenant.name
    for tenant in db.query(Tenant).filter(Tenant.id.in_(tenant_ids or {0})).all()
  }
  return [
    UsageEventRead(
      id=row.id,
      kind=row.kind,
      path=row.path,
      action=row.action,
      method=row.method,
      status_code=row.status_code,
      message=row.message,
      user_id=row.user_id,
      user_email=emails.get(row.user_id) if row.user_id else None,
      tenant_id=row.tenant_id,
      tenant_name=names.get(row.tenant_id) if row.tenant_id else None,
      role=row.role,
      created_at=row.created_at,
    )
    for row in rows
  ]

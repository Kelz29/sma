from contextvars import ContextVar
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.db.models.tenant import Tenant
from app.db.session import SessionLocal

_tenant_id_ctx: ContextVar[Optional[int]] = ContextVar("tenant_id", default=None)


def get_current_tenant_id() -> Optional[int]:
  return _tenant_id_ctx.get()


class TenantContextMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request: Request, call_next):
    raw = request.headers.get("X-Tenant-Id")
    tenant_id: Optional[int] = None

    if raw:
      with SessionLocal() as db:
        # Accept either numeric tenant id or slug
        if raw.isdigit():
          tenant = db.query(Tenant).filter(Tenant.id == int(raw)).first()
        else:
          tenant = db.query(Tenant).filter(Tenant.slug == raw).first()
        if tenant:
          tenant_id = tenant.id

    token = _tenant_id_ctx.set(tenant_id)
    try:
      response = await call_next(request)
    finally:
      _tenant_id_ctx.reset(token)
    return response


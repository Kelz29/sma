import os
import sys

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging_config import configure_logging

configure_logging()

from app.api.v1 import auth as auth_router
from app.api.v1 import public as public_router
from app.api.v1 import feature_flags as feature_flags_router
from app.api.v1 import accounts as accounts_router
from app.api.v1 import company as company_router
from app.api.v1 import customers as customers_router
from app.api.v1 import invoices as invoices_router
from app.api.v1 import line_item_templates as line_item_templates_router
from app.api.v1 import expenses as expenses_router
from app.api.v1 import banking as banking_router
from app.api.v1 import admin as admin_router
from app.api.v1 import employees as employees_router
from app.api.v1 import leave as leave_router
from app.api.v1 import attendance as attendance_router
from app.api.v1 import payslips as payslips_router
from app.api.v1 import portal as portal_router
from app.api.v1 import reports as reports_router
from app.api.v1 import sales as sales_router
from app.api.v1 import employees as employees_router
from app.api.v1 import leave as leave_router
from app.api.v1 import attendance as attendance_router
from app.api.v1 import payslips as payslips_router
from app.api.v1 import portal as portal_router
from app.middleware.monitoring import MonitoringMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.tenant_context import TenantContextMiddleware

def _validate_production_config() -> None:
  """Reject startup if production and critical secrets are default."""
  env = getattr(settings, "ENVIRONMENT", "development").strip().lower()
  if env != "production":
    return
  sk = getattr(settings, "SECRET_KEY", "") or ""
  if sk == "CHANGE_ME" or len(sk) < 32:
    print("FATAL: In production, set SECRET_KEY to a strong random value (min 32 characters).", file=sys.stderr)
    sys.exit(1)


app = FastAPI(title=settings.APP_NAME)


@app.on_event("startup")
def startup_validate_config() -> None:
  _validate_production_config()

# CORS: in production set CORS_ORIGINS to a comma-separated list of allowed origins (e.g. https://app.example.com).
_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] if settings.CORS_ORIGINS != "*" else ["*"]
app.add_middleware(
  CORSMiddleware,
  allow_origins=_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)
app.add_middleware(MonitoringMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
# Capture request-scoped context (e.g. IP) early
app.add_middleware(RequestContextMiddleware)
app.add_middleware(TenantContextMiddleware)

app.include_router(auth_router.router, prefix=f"{settings.API_V1_STR}/auth")
app.include_router(public_router.router, prefix=settings.API_V1_STR)
app.include_router(feature_flags_router.router, prefix=settings.API_V1_STR)
app.include_router(accounts_router.router, prefix=f"{settings.API_V1_STR}/accounts")
app.include_router(company_router.router, prefix=f"{settings.API_V1_STR}/company")
app.include_router(customers_router.router, prefix=f"{settings.API_V1_STR}/customers")
app.include_router(invoices_router.router, prefix=f"{settings.API_V1_STR}/invoices")
app.include_router(line_item_templates_router.router, prefix=f"{settings.API_V1_STR}/line-item-templates")
app.include_router(expenses_router.router, prefix=f"{settings.API_V1_STR}/expenses")
app.include_router(banking_router.router, prefix=f"{settings.API_V1_STR}/banking")
app.include_router(admin_router.router, prefix=f"{settings.API_V1_STR}/admin")
app.include_router(employees_router.router, prefix=f"{settings.API_V1_STR}/employees")
app.include_router(leave_router.router, prefix=f"{settings.API_V1_STR}/leave")
app.include_router(attendance_router.router, prefix=f"{settings.API_V1_STR}/attendance")
app.include_router(payslips_router.router, prefix=f"{settings.API_V1_STR}/payslips")
app.include_router(portal_router.router, prefix=f"{settings.API_V1_STR}/portal")
app.include_router(reports_router.router, prefix=f"{settings.API_V1_STR}/reports")
app.include_router(sales_router.router, prefix=settings.API_V1_STR)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
  """Prevent internal errors from leaking to clients; log server-side. HTTPException is handled by FastAPI."""
  from fastapi import HTTPException
  from fastapi.responses import JSONResponse

  from app.core.logging_config import get_logger
  from app.monitoring.metrics import record_error

  if isinstance(exc, HTTPException):
    raise exc
  logger = get_logger(__name__)
  logger.exception("Unhandled exception", path=request.url.path, method=request.method)
  record_error()
  return JSONResponse(
    status_code=500,
    content={"detail": "An internal error occurred. Please try again later."},
  )


@app.get("/health")
def health_check():
  """Shallow health check. Include db=ok when database is reachable."""
  from sqlalchemy import text
  from app.db.session import engine
  payload = {"status": "ok"}
  try:
    with engine.connect() as conn:
      conn.execute(text("SELECT 1"))
    payload["db"] = "ok"
  except Exception:
    payload["db"] = "error"
  return payload


@app.get("/metrics")
def metrics():
  """
  Basic in-memory metrics for monitoring. Returns request counts, error count, and uptime.
  In production, restrict access (e.g. internal network or metrics key).
  """
  from app.monitoring.metrics import get_metrics
  return get_metrics()


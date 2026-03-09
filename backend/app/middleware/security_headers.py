from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Report-only CSP: collect violations without blocking; tighten in production as needed.
    response.headers["Content-Security-Policy-Report-Only"] = (
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none';"
    )
    env = getattr(settings, "ENVIRONMENT", "development").strip().lower()
    if env == "production":
      response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response

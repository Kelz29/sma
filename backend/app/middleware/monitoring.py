"""
Request logging and metrics middleware. Logs each request with duration and status;
increments in-memory metrics for /metrics endpoint.
"""
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging_config import get_logger
from app.monitoring.metrics import record_error, record_request

logger = get_logger("http")


class MonitoringMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request: Request, call_next) -> Response:
    start = time.monotonic()
    method = request.method
    path = request.url.path
    client = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
      client = forwarded.split(",")[0].strip()

    response = await call_next(request)
    status = response.status_code
    duration_ms = round((time.monotonic() - start) * 1000, 2)

    record_request(status)
    if status >= 500:
      record_error()

    # Skip logging for health/metrics to reduce noise
    if path not in ("/health", "/metrics"):
      logger.info(
        "request",
        method=method,
        path=path,
        status=status,
        duration_ms=duration_ms,
        client=client,
      )
    return response

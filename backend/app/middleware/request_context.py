from contextvars import ContextVar
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


_ip_ctx: ContextVar[Optional[str]] = ContextVar("ip_address", default=None)


def get_request_ip() -> Optional[str]:
  return _ip_ctx.get()


class RequestContextMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request: Request, call_next):
    # Prefer X-Forwarded-For in proxy setups, fallback to client.host
    forwarded = request.headers.get("x-forwarded-for")
    ip = None
    if forwarded:
      ip = forwarded.split(",")[0].strip()
    elif request.client:
      ip = request.client.host

    token = _ip_ctx.set(ip)
    try:
      response = await call_next(request)
    finally:
      _ip_ctx.reset(token)
    return response


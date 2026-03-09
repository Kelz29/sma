"""
Rate limiter for auth endpoints. Uses Redis when REDIS_URL is set (distributed across workers),
otherwise in-memory (single process).
"""
import time
from collections import defaultdict
from typing import Optional

from app.core.redis_client import redis_incr

# In-memory fallback when Redis not available
_store: dict[str, list[float]] = defaultdict(list)
_WINDOW_SEC = 60
_MAX_LOGIN_PER_WINDOW = 10
_MAX_REGISTER_PER_WINDOW = 5


def _client_key(prefix: str, identifier: str) -> str:
  return f"ratelimit:{prefix}:{identifier}"


def _prune(timestamps: list[float], window_sec: float) -> None:
  cutoff = time.monotonic() - window_sec
  while timestamps and timestamps[0] < cutoff:
    timestamps.pop(0)


def check_rate_limit(
  key_prefix: str,
  identifier: str,
  max_per_window: int,
  window_sec: float = _WINDOW_SEC,
) -> Optional[str]:
  """
  Returns None if allowed, or an error message if rate limited.
  Uses Redis when available, else in-memory store.
  """
  # Try Redis first
  rkey = _client_key(key_prefix, identifier)
  n = redis_incr(rkey, ttl_seconds=int(window_sec))
  if n is not None:
    if n > max_per_window:
      return "Too many attempts. Please try again later."
    return None

  # Fallback: in-memory
  key = f"{key_prefix}:{identifier}"
  now = time.monotonic()
  _prune(_store[key], window_sec)
  if len(_store[key]) >= max_per_window:
    return "Too many attempts. Please try again later."
  _store[key].append(now)
  return None


def check_auth_rate_limit(identifier: str, is_login: bool) -> Optional[str]:
  max_attempts = _MAX_LOGIN_PER_WINDOW if is_login else _MAX_REGISTER_PER_WINDOW
  prefix = "login" if is_login else "register"
  return check_rate_limit(prefix, identifier, max_attempts, _WINDOW_SEC)

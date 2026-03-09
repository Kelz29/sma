"""
Unified store API: uses our in-memory Redis-like implementation by default.
When REDIS_URL is set, uses real Redis instead. All keys are prefixed with sma:.
"""
import json
from typing import Any, List, Optional

from app.core.config import settings
from app.core import redis_like

_KEY_PREFIX = "sma:"
_redis_client: Optional[Any] = None


def get_redis():
  """Return real Redis client if REDIS_URL is set and reachable, else None (we use redis_like)."""
  global _redis_client
  url = getattr(settings, "REDIS_URL", None)
  if not url or not str(url).strip():
    return None
  if _redis_client is None:
    try:
      import redis
      _redis_client = redis.from_url(url, decode_responses=True)
      _redis_client.ping()
    except Exception:
      _redis_client = False
  return _redis_client if _redis_client else None


def _key(name: str) -> str:
  return f"{_KEY_PREFIX}{name}"


def _store_get(k: str) -> Optional[str]:
  r = get_redis()
  if r:
    try:
      return r.get(k)
    except Exception:
      return None
  return redis_like.get(k)


def _store_set(k: str, value: str, ttl_seconds: Optional[int] = None) -> bool:
  r = get_redis()
  if r:
    try:
      r.set(k, value)
      if ttl_seconds is not None:
        r.expire(k, ttl_seconds)
      return True
    except Exception:
      return False
  return redis_like.set(k, value, ttl_seconds)


def _store_incr(k: str, ttl_seconds: Optional[int] = None) -> Optional[int]:
  r = get_redis()
  if r:
    try:
      n = r.incr(k)
      if ttl_seconds is not None:
        r.expire(k, ttl_seconds)
      return n
    except Exception:
      return None
  return redis_like.incr(k, ttl_seconds)


def _store_incrby(k: str, amount: int = 1) -> Optional[int]:
  r = get_redis()
  if r:
    try:
      return r.incrby(k, amount)
    except Exception:
      return None
  return redis_like.incrby(k, amount)


def _store_delete(k: str) -> bool:
  r = get_redis()
  if r:
    try:
      r.delete(k)
      return True
    except Exception:
      return False
  return redis_like.delete(k)


def _store_mget(keys: List[str]) -> List[Optional[str]]:
  r = get_redis()
  if r:
    try:
      return r.mget(keys) or [None] * len(keys)
    except Exception:
      pass
  return redis_like.mget(keys)


def redis_get(key: str) -> Optional[str]:
  """Get a string value. Uses our Redis-like store or real Redis."""
  return _store_get(_key(key))


def redis_set(key: str, value: str, ttl_seconds: Optional[int] = None) -> bool:
  """Set a string value with optional TTL."""
  return _store_set(_key(key), value, ttl_seconds)


def redis_incr(key: str, ttl_seconds: Optional[int] = None) -> Optional[int]:
  """Increment a counter. Optional TTL for the key. Returns the new value."""
  return _store_incr(_key(key), ttl_seconds)


def redis_incrby(key: str, amount: int = 1) -> Optional[int]:
  """Increment by amount. Returns new value."""
  return _store_incrby(_key(key), amount)


def redis_mget(keys: List[str]) -> List[Optional[str]]:
  """Get multiple keys (unprefixed). Keys will be prefixed with sma:. Returns list of values."""
  prefixed = [_key(k) for k in keys]
  return _store_mget(prefixed)


def cache_get(key: str) -> Optional[Any]:
  """Get a cached value (JSON-decoded)."""
  raw = redis_get(f"cache:{key}")
  if raw is None:
    return None
  try:
    return json.loads(raw)
  except Exception:
    return None


def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> bool:
  """Set a cached value (JSON-encoded) with TTL."""
  try:
    raw = json.dumps(value)
    return redis_set(f"cache:{key}", raw, ttl_seconds=ttl_seconds)
  except Exception:
    return False


def cache_delete(key: str) -> bool:
  """Delete a cache key."""
  return _store_delete(_key(f"cache:{key}"))


def is_redis_available() -> bool:
  """True if real Redis is configured and reachable. False when using our in-memory store."""
  return get_redis() is not None

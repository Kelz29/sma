"""
Our own in-memory Redis-like implementation.

Provides a minimal Redis-compatible API so the app can run without a Redis server.
Used by app.core.redis_client when REDIS_URL is not set (rate limiting, metrics, cache).
When REDIS_URL is set, redis_client uses real Redis instead.

Supported operations:
  get(key) -> str | None
  set(key, value, ttl_seconds=None) -> bool
  setex(key, ttl_seconds, value) -> bool
  exists(key) -> 0 | 1
  expire(key, ttl_seconds) -> bool
  ttl(key) -> int  (-2 missing, -1 no expiry, >=0 seconds left)
  incr(key, ttl_seconds=None) -> int
  incrby(key, amount=1) -> int
  delete(key) -> bool
  mget(keys) -> list[str | None]
  clear() -> None   (for tests)
  dbsize() -> int   (for debugging)

Thread-safe (RLock). Expiry is lazy: expired keys are removed on next get/exists/ttl/mget.
"""
import time
import threading
from typing import Optional

# (value, expiry_ts or None). expiry_ts is time.monotonic() + ttl at set time.
_data: dict[str, tuple[str, Optional[float]]] = {}
_lock = threading.RLock()


def _now() -> float:
  return time.monotonic()


def _expired(expiry: Optional[float]) -> bool:
  if expiry is None:
    return False
  return _now() >= expiry


def get(key: str) -> Optional[str]:
  """Get a string value. Returns None if key is missing or expired."""
  with _lock:
    entry = _data.get(key)
    if entry is None:
      return None
    value, expiry = entry
    if _expired(expiry):
      del _data[key]
      return None
    return value


def set(key: str, value: str, ttl_seconds: Optional[int] = None) -> bool:
  """Set a string value. If ttl_seconds is set, the key expires after that many seconds. Returns True."""
  with _lock:
    expiry = (_now() + ttl_seconds) if ttl_seconds is not None else None
    _data[key] = (value, expiry)
    return True


def setex(key: str, ttl_seconds: int, value: str) -> bool:
  """Set a string value with TTL (Redis SETEX). Returns True."""
  return set(key, value, ttl_seconds=ttl_seconds)


def exists(key: str) -> int:
  """Return 1 if key exists and is not expired, 0 otherwise (Redis EXISTS)."""
  with _lock:
    entry = _data.get(key)
    if entry is None:
      return 0
    if _expired(entry[1]):
      del _data[key]
      return 0
    return 1


def expire(key: str, ttl_seconds: int) -> bool:
  """Set TTL on an existing key. Returns True if key existed and was updated, False otherwise."""
  with _lock:
    entry = _data.get(key)
    if entry is None:
      return False
    value, _ = entry
    if _expired(entry[1]):
      del _data[key]
      return False
    _data[key] = (value, _now() + ttl_seconds)
    return True


def ttl(key: str) -> int:
  """
  Return remaining TTL in seconds. Returns -1 if key has no expiry, -2 if key does not exist.
  (Redis TTL semantics.)
  """
  with _lock:
    entry = _data.get(key)
    if entry is None:
      return -2
    _, expiry = entry
    if _expired(expiry):
      del _data[key]
      return -2
    if expiry is None:
      return -1
    remaining = int(expiry - _now())
    return max(0, remaining)


def incr(key: str, ttl_seconds: Optional[int] = None) -> int:
  """
  Increment a counter. Key is created at 0 if missing. Returns the new value.
  If ttl_seconds is set, the key expires after that many seconds from this call.
  """
  with _lock:
    entry = _data.get(key)
    if entry is None:
      n = 1
    else:
      val, expiry = entry
      if _expired(expiry):
        n = 1
      else:
        try:
          n = int(val) + 1
        except (ValueError, TypeError):
          n = 1
    expiry = (_now() + ttl_seconds) if ttl_seconds is not None else None
    _data[key] = (str(n), expiry)
    return n


def incrby(key: str, amount: int = 1) -> int:
  """Increment by amount. Key is created at 0 if missing. Returns the new value."""
  with _lock:
    entry = _data.get(key)
    if entry is None:
      n = amount
    else:
      val, expiry = entry
      if _expired(expiry):
        n = amount
      else:
        try:
          n = int(val) + amount
        except (ValueError, TypeError):
          n = amount
    _data[key] = (str(n), None)
    return n


def delete(key: str) -> bool:
  """Remove the key. Returns True if it existed (or was expired)."""
  with _lock:
    if key in _data:
      del _data[key]
      return True
    return False


def mget(keys: list[str]) -> list[Optional[str]]:
  """Get multiple keys. Returns a list of values (None for missing or expired)."""
  with _lock:
    out = []
    for k in keys:
      entry = _data.get(k)
      if entry is None:
        out.append(None)
        continue
      value, expiry = entry
      if _expired(expiry):
        del _data[k]
        out.append(None)
      else:
        out.append(value)
    return out


def clear() -> None:
  """Remove all keys. Mainly for tests."""
  with _lock:
    _data.clear()


def dbsize() -> int:
  """Return number of keys (including expired until next access). For debugging."""
  with _lock:
    return len(_data)

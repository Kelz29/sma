"""
Metrics for basic monitoring. Uses the unified store (our Redis-like implementation
or real Redis when REDIS_URL is set).
"""
import time
from typing import Any

from app.core.redis_client import is_redis_available, redis_incrby, redis_mget

_started_at: float = time.monotonic()

_METRIC_KEYS = [
  "metrics:requests_total",
  "metrics:errors_total",
  "metrics:status_2xx",
  "metrics:status_4xx",
  "metrics:status_5xx",
]


def record_request(status_code: int) -> None:
  redis_incrby("metrics:requests_total")
  if 200 <= status_code < 300:
    redis_incrby("metrics:status_2xx")
  elif 400 <= status_code < 500:
    redis_incrby("metrics:status_4xx")
  elif status_code >= 500:
    redis_incrby("metrics:status_5xx")


def record_error() -> None:
  redis_incrby("metrics:errors_total")


def get_metrics() -> dict[str, Any]:
  values = redis_mget(_METRIC_KEYS)
  return {
    "requests_total": int(values[0] or 0),
    "errors_total": int(values[1] or 0),
    "status_2xx": int(values[2] or 0),
    "status_4xx": int(values[3] or 0),
    "status_5xx": int(values[4] or 0),
    "uptime_seconds": round(time.monotonic() - _started_at, 1),
    "store": "redis" if is_redis_available() else "memory",
  }


def get_started_at() -> float:
  return _started_at

"""
Structured logging for production (JSON) and development (readable).
Call configure_logging() at app startup.
"""
import logging
import sys

import structlog

from app.core.config import settings


def configure_logging() -> None:
  """Configure structlog and standard logging. JSON in production, console in development."""
  env = getattr(settings, "ENVIRONMENT", "development").strip().lower()
  if env == "production":
    structlog.configure(
      processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
      ],
      wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
      context_class=dict,
      logger_factory=structlog.PrintLoggerFactory(),
      cache_logger_on_first_use=True,
    )
  else:
    structlog.configure(
      processors=[
        structlog.contextvars.merge_contextvars,
        structlog.dev.ConsoleRenderer(colors=True),
      ],
      wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG),
      context_class=dict,
      logger_factory=structlog.PrintLoggerFactory(),
      cache_logger_on_first_use=True,
    )
  logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=logging.INFO,
  )


def get_logger(name: str):
  """Return a structlog logger bound to the given name."""
  return structlog.get_logger(name)

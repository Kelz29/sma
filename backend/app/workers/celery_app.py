"""Celery application for SmartSeen background jobs (email queue)."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

broker = settings.celery_broker_url or "memory://"

celery = Celery("sma", broker=broker, include=["app.workers.email_tasks"])

celery.conf.update(
  task_default_queue="sma_email",
  task_acks_late=True,
  worker_prefetch_multiplier=1,
  task_serializer="json",
  accept_content=["json"],
  result_serializer="json",
  timezone="UTC",
  enable_utc=True,
  # memory:// is only for import safety when REDIS_URL is unset; production must set broker.
  broker_connection_retry_on_startup=True,
)

"""Enqueue transactional emails into the outbox and optionally dispatch Celery."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.email_outbox import EmailOutbox

logger = logging.getLogger(__name__)

KIND_WELCOME_VERIFY = "welcome_verify"
KIND_EMAIL_CONFIRMED = "email_confirmed"
KIND_INVOICE = "invoice"
KIND_REPORT = "report"


def enqueue_email(
  db: Session,
  *,
  kind: str,
  to_email: str,
  payload: dict[str, Any],
  idempotency_key: str,
) -> EmailOutbox | None:
  """
  Insert a pending outbox row (idempotent on idempotency_key) and dispatch the worker.

  Returns the existing or new row, or None if insert failed unexpectedly.
  In development without a Celery broker, processes the job synchronously after commit.
  """
  to_email = (to_email or "").strip()
  if not to_email:
    logger.warning("enqueue_email skipped: empty to_email kind=%s", kind)
    return None

  existing = (
    db.query(EmailOutbox)
    .filter(EmailOutbox.idempotency_key == idempotency_key)
    .first()
  )
  if existing:
    if existing.status in ("pending", "failed"):
      _dispatch_job(existing.id)
    return existing

  job = EmailOutbox(
    kind=kind,
    to_email=to_email,
    payload_json=json.dumps(payload),
    status="pending",
    attempts=0,
    idempotency_key=idempotency_key,
    scheduled_at=datetime.utcnow(),
  )
  db.add(job)
  try:
    db.commit()
    db.refresh(job)
  except IntegrityError:
    db.rollback()
    existing = (
      db.query(EmailOutbox)
      .filter(EmailOutbox.idempotency_key == idempotency_key)
      .first()
    )
    if existing:
      if existing.status in ("pending", "failed"):
        _dispatch_job(existing.id)
      return existing
    logger.exception("enqueue_email IntegrityError without existing row key=%s", idempotency_key)
    return None

  _dispatch_job(job.id)
  return job


def _dispatch_job(job_id: int) -> None:
  broker = settings.celery_broker_url
  if broker:
    try:
      from app.workers.email_tasks import send_email_job

      send_email_job.delay(job_id)
      return
    except Exception:
      logger.exception("Failed to enqueue Celery job_id=%s; falling back if allowed", job_id)

  # Dev / no broker: send inline so local register still works when SMTP is set.
  if (settings.ENVIRONMENT or "development").lower() != "production":
    try:
      from app.workers.email_tasks import process_email_job

      process_email_job(job_id)
    except Exception:
      logger.exception("Sync email fallback failed for job_id=%s", job_id)
  else:
    logger.error(
      "Email job_id=%s left pending: no Celery broker in production (set REDIS_URL/CELERY_BROKER_URL)",
      job_id,
    )

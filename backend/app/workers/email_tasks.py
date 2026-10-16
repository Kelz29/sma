"""Celery tasks that drain the email outbox."""
from __future__ import annotations

import json
import logging
from datetime import datetime

from app.core.config import settings
from app.db.models.email_outbox import EmailOutbox
from app.db.session import SessionLocal
from app.utils.email_sender import dispatch_outbox_payload
from app.workers.celery_app import celery

logger = logging.getLogger(__name__)


def process_email_job(job_id: int) -> str:
  """
  Claim a pending/failed outbox row, send via SMTP, update status.
  Returns a short status string for logging/tests.
  """
  db = SessionLocal()
  try:
    job = db.query(EmailOutbox).filter(EmailOutbox.id == job_id).first()
    if not job:
      return "missing"
    if job.status == "sent":
      return "already_sent"
    if job.status == "sending":
      return "busy"

    max_attempts = int(getattr(settings, "EMAIL_MAX_ATTEMPTS", 5) or 5)
    if job.attempts >= max_attempts and job.status == "failed":
      return "max_attempts"

    # Optimistic claim
    updated = (
      db.query(EmailOutbox)
      .filter(
        EmailOutbox.id == job_id,
        EmailOutbox.status.in_(("pending", "failed")),
      )
      .update(
        {
          EmailOutbox.status: "sending",
          EmailOutbox.attempts: EmailOutbox.attempts + 1,
          EmailOutbox.updated_at: datetime.utcnow(),
        },
        synchronize_session=False,
      )
    )
    db.commit()
    if not updated:
      return "busy"

    job = db.query(EmailOutbox).filter(EmailOutbox.id == job_id).first()
    if not job:
      return "missing"

    try:
      payload = json.loads(job.payload_json or "{}")
    except json.JSONDecodeError:
      payload = {}

    try:
      dispatch_outbox_payload(job.kind, job.to_email, payload)
      job.status = "sent"
      job.sent_at = datetime.utcnow()
      job.last_error = None
      job.updated_at = datetime.utcnow()
      db.add(job)
      db.commit()
      return "sent"
    except Exception as e:
      logger.exception("Email job_id=%s failed: %s", job_id, e)
      job.last_error = str(e)[:2000]
      job.updated_at = datetime.utcnow()
      if job.attempts >= max_attempts:
        job.status = "failed"
      else:
        job.status = "pending"
      db.add(job)
      db.commit()
      raise
  finally:
    db.close()


@celery.task(name="app.workers.email_tasks.send_email_job", bind=True, max_retries=0)
def send_email_job(self, job_id: int) -> str:  # noqa: ARG001
  return process_email_job(job_id)

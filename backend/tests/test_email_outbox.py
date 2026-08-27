"""Tests for email outbox enqueue + worker processing."""
from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.email_outbox import EmailOutbox
from app.db.models.user import EmailVerificationToken, User
from app.utils.email_queue import (
  KIND_EMAIL_CONFIRMED,
  KIND_WELCOME_VERIFY,
  enqueue_email,
)
from app.workers.email_tasks import process_email_job
from tests.conftest import TestingSessionLocal, override_get_db


def _db() -> Session:
  return next(override_get_db())


def test_enqueue_creates_outbox_row() -> None:
  db = _db()
  try:
    with patch("app.utils.email_queue._dispatch_job"):
      job = enqueue_email(
        db,
        kind=KIND_WELCOME_VERIFY,
        to_email="a@example.com",
        payload={"full_name": "A"},
        idempotency_key="test_enqueue_creates:1",
      )
    assert job is not None
    assert job.status == "pending"
    assert job.kind == KIND_WELCOME_VERIFY
    row = db.query(EmailOutbox).filter(EmailOutbox.id == job.id).first()
    assert row is not None
  finally:
    db.close()


def test_enqueue_idempotent_same_key() -> None:
  db = _db()
  try:
    with patch("app.utils.email_queue._dispatch_job"):
      j1 = enqueue_email(
        db,
        kind=KIND_WELCOME_VERIFY,
        to_email="b@example.com",
        payload={"full_name": "B"},
        idempotency_key="test_enqueue_idem:1",
      )
      j2 = enqueue_email(
        db,
        kind=KIND_WELCOME_VERIFY,
        to_email="b@example.com",
        payload={"full_name": "B2"},
        idempotency_key="test_enqueue_idem:1",
      )
    assert j1 is not None and j2 is not None
    assert j1.id == j2.id
    count = (
      db.query(EmailOutbox)
      .filter(EmailOutbox.idempotency_key == "test_enqueue_idem:1")
      .count()
    )
    assert count == 1
  finally:
    db.close()


def test_process_email_job_marks_sent() -> None:
  db = _db()
  try:
    with patch("app.utils.email_queue._dispatch_job"):
      job = enqueue_email(
        db,
        kind=KIND_EMAIL_CONFIRMED,
        to_email="c@example.com",
        payload={"full_name": "C"},
        idempotency_key="test_process_sent:1",
      )
    assert job is not None
    with patch("app.workers.email_tasks.dispatch_outbox_payload") as send:
      result = process_email_job(job.id)
    assert result == "sent"
    send.assert_called_once()
    db.expire_all()
    refreshed = db.query(EmailOutbox).filter(EmailOutbox.id == job.id).first()
    assert refreshed is not None
    assert refreshed.status == "sent"
    assert refreshed.sent_at is not None
  finally:
    db.close()


def test_process_email_job_failure_retries() -> None:
  db = _db()
  try:
    with patch("app.utils.email_queue._dispatch_job"):
      job = enqueue_email(
        db,
        kind=KIND_WELCOME_VERIFY,
        to_email="d@example.com",
        payload={"full_name": "D"},
        idempotency_key="test_process_fail:1",
      )
    assert job is not None
    with patch(
      "app.workers.email_tasks.dispatch_outbox_payload",
      side_effect=RuntimeError("smtp down"),
    ):
      try:
        process_email_job(job.id)
        assert False, "expected raise"
      except RuntimeError:
        pass
    db.expire_all()
    refreshed = db.query(EmailOutbox).filter(EmailOutbox.id == job.id).first()
    assert refreshed is not None
    assert refreshed.status == "pending"
    assert refreshed.attempts == 1
    assert refreshed.last_error and "smtp down" in refreshed.last_error
  finally:
    db.close()


def test_register_enqueues_welcome(client: TestClient) -> None:
  with patch("app.api.v1.auth.enqueue_email") as enq:
    enq.return_value = None
    r = client.post(
      "/api/v1/auth/register",
      json={
        "email": "emailqueue-reg@example.com",
        "password": "Password123!",
        "full_name": "Queue User",
        "tenant_name": "Queue Co",
        "tenant_slug": "queue-co-email",
      },
    )
  assert r.status_code == 201
  assert enq.called
  kwargs = enq.call_args.kwargs
  assert kwargs["kind"] == KIND_WELCOME_VERIFY
  assert kwargs["to_email"] == "emailqueue-reg@example.com"
  assert kwargs["idempotency_key"].startswith("welcome_verify:")


def test_verify_enqueues_confirmed(client: TestClient) -> None:
  db = TestingSessionLocal()
  try:
    user = User(
      email="emailqueue-verify@example.com",
      full_name="Verify Me",
      hashed_password="x",
      is_active=True,
      email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    from datetime import datetime, timedelta

    token = "verify-enqueue-token-xyz"
    db.add(
      EmailVerificationToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=1),
      )
    )
    db.commit()
  finally:
    db.close()

  with patch("app.api.v1.auth.enqueue_email") as enq:
    enq.return_value = None
    r = client.get("/api/v1/auth/verify-email", params={"token": token})
  assert r.status_code == 200
  assert enq.called
  kwargs = enq.call_args.kwargs
  assert kwargs["kind"] == KIND_EMAIL_CONFIRMED
  assert kwargs["idempotency_key"].startswith("email_confirmed:")

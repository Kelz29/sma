"""Durable email outbox for queued transactional mail."""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EmailOutbox(Base):
  __tablename__ = "email_outbox"
  __table_args__ = (UniqueConstraint("idempotency_key", name="uq_email_outbox_idempotency"),)

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  kind: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
  to_email: Mapped[str] = mapped_column(String(255), nullable=False)
  payload_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
  status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
  attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
  idempotency_key: Mapped[str] = mapped_column(String(191), nullable=False)
  last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
  scheduled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
  sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
  )

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UsageEvent(Base):
  """First-party product usage. No invoice amounts, customer names, or request bodies."""

  __tablename__ = "usage_events"
  __table_args__ = (
    Index("ix_usage_events_created_at", "created_at"),
    Index("ix_usage_events_tenant_id", "tenant_id"),
  )

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  kind: Mapped[str] = mapped_column(String(32), nullable=False)
  path: Mapped[str] = mapped_column(String(255), nullable=False)
  action: Mapped[str | None] = mapped_column(String(64), nullable=True)
  method: Mapped[str | None] = mapped_column(String(16), nullable=True)
  status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
  message: Mapped[str | None] = mapped_column(Text, nullable=True)
  stack: Mapped[str | None] = mapped_column(Text, nullable=True)
  user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
  tenant_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
  role: Mapped[str | None] = mapped_column(String(50), nullable=True)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class WaitlistEntry(Base):
  __tablename__ = "waitlist_entries"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

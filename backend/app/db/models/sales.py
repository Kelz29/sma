"""Sales module: leads, proposals, contracts, pitch decks, pipeline (deals)."""
from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Lead(Base):
  __tablename__ = "sales_leads"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)

  name: Mapped[str] = mapped_column(String(255), nullable=False)
  email: Mapped[str | None] = mapped_column(String(255))
  company: Mapped[str | None] = mapped_column(String(255))
  phone: Mapped[str | None] = mapped_column(String(50))
  source: Mapped[str | None] = mapped_column(String(100))  # e.g. website, referral
  status: Mapped[str] = mapped_column(String(50), default="new")  # new, contacted, qualified, lost
  estimated_value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
  notes: Mapped[str | None] = mapped_column(Text)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class Proposal(Base):
  __tablename__ = "sales_proposals"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  lead_id: Mapped[int | None] = mapped_column(ForeignKey("sales_leads.id", ondelete="SET NULL"), nullable=True, index=True)

  title: Mapped[str] = mapped_column(String(255), nullable=False)
  status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, sent, accepted, declined
  value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
  currency: Mapped[str | None] = mapped_column(String(3), default="ZAR")
  sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
  accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
  notes: Mapped[str | None] = mapped_column(Text)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class Contract(Base):
  __tablename__ = "sales_contracts"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  proposal_id: Mapped[int | None] = mapped_column(ForeignKey("sales_proposals.id", ondelete="SET NULL"), nullable=True, index=True)
  lead_id: Mapped[int | None] = mapped_column(ForeignKey("sales_leads.id", ondelete="SET NULL"), nullable=True, index=True)

  title: Mapped[str] = mapped_column(String(255), nullable=False)
  party_name: Mapped[str | None] = mapped_column(String(255))  # customer/lead name
  start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
  end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
  value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
  currency: Mapped[str | None] = mapped_column(String(3), default="ZAR")
  document_url: Mapped[str | None] = mapped_column(String(500))  # path or URL to signed doc
  status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, active, expired
  notes: Mapped[str | None] = mapped_column(Text)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class Deal(Base):
  __tablename__ = "sales_deals"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  lead_id: Mapped[int | None] = mapped_column(ForeignKey("sales_leads.id", ondelete="SET NULL"), nullable=True, index=True)

  name: Mapped[str] = mapped_column(String(255), nullable=False)
  stage: Mapped[str] = mapped_column(String(50), default="qualified")  # qualified, proposal, negotiation, won, lost
  value: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
  currency: Mapped[str | None] = mapped_column(String(3), default="ZAR")
  expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
  notes: Mapped[str | None] = mapped_column(Text)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class PitchDeck(Base):
  __tablename__ = "sales_pitch_decks"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  lead_id: Mapped[int | None] = mapped_column(ForeignKey("sales_leads.id", ondelete="SET NULL"), nullable=True, index=True)
  deal_id: Mapped[int | None] = mapped_column(ForeignKey("sales_deals.id", ondelete="SET NULL"), nullable=True, index=True)

  title: Mapped[str] = mapped_column(String(255), nullable=False)
  file_url: Mapped[str | None] = mapped_column(String(500))  # path or URL
  notes: Mapped[str | None] = mapped_column(Text)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )

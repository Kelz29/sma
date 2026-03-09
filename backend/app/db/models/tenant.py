from sqlalchemy import Float, String, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
import enum


class TenantStatus(str, enum.Enum):
  active = "active"
  suspended = "suspended"


class Tenant(Base):
  __tablename__ = "tenants"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  name: Mapped[str] = mapped_column(String(255), nullable=False)
  slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
  status: Mapped[TenantStatus] = mapped_column(Enum(TenantStatus), default=TenantStatus.active)
  # Company branding for invoices/quotations
  logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
  address: Mapped[str | None] = mapped_column(Text, nullable=True)
  footer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
  # Company banking (shown on invoices/quotations)
  bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
  bank_account_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
  bank_branch_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
  # Colour palette (hex, e.g. #059669) – used in invoice PDF themes
  primary_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
  secondary_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
  # Defaults for new documents (invoices, etc.)
  default_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)  # e.g. ZAR, USD
  default_vat_rate: Mapped[float | None] = mapped_column(Float, nullable=True)  # e.g. 15.0
  default_vat_country: Mapped[str | None] = mapped_column(String(2), nullable=True)  # e.g. ZA
  # Company registration (e.g. CIPC)
  company_registration_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
  company_registration_country: Mapped[str | None] = mapped_column(String(2), nullable=True)  # e.g. ZA
  cipc_document_url: Mapped[str | None] = mapped_column(String(512), nullable=True)  # URL to CIPC registration document

  users: Mapped[list["TenantUser"]] = relationship(back_populates="tenant")


from __future__ import annotations

from datetime import datetime
import enum

from sqlalchemy import (
  String,
  Enum,
  ForeignKey,
  Boolean,
  Numeric,
  Integer,
  Date,
  DateTime,
  Text,
  JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AccountCategory(str, enum.Enum):
  asset = "asset"
  liability = "liability"
  equity = "equity"
  revenue = "revenue"
  expense = "expense"


class Account(Base):
  __tablename__ = "accounts"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)

  code: Mapped[str] = mapped_column(String(50), nullable=False)
  name: Mapped[str] = mapped_column(String(255), nullable=False)
  category: Mapped[AccountCategory] = mapped_column(Enum(AccountCategory), nullable=False)

  parent_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
  parent: Mapped["Account | None"] = relationship(remote_side="Account.id", backref="children")

  opening_debit: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
  opening_credit: Mapped[float] = mapped_column(Numeric(18, 4), default=0)

  is_active: Mapped[bool] = mapped_column(Boolean, default=True)
  is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
  deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class InvoiceStatus(str, enum.Enum):
  draft = "draft"
  sent = "sent"
  paid = "paid"
  overdue = "overdue"
  cancelled = "cancelled"


class Customer(Base):
  __tablename__ = "customers"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)

  name: Mapped[str] = mapped_column(String(255), nullable=False)
  email: Mapped[str | None] = mapped_column(String(255))
  address: Mapped[str | None] = mapped_column(Text)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class Invoice(Base):
  __tablename__ = "invoices"

  id: Mapped[int] = mapped_column(primary_key=True)
  uuid: Mapped[str | None] = mapped_column(String(36), unique=True, nullable=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)

  invoice_number: Mapped[int] = mapped_column(Integer, nullable=False)
  customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
  customer_email: Mapped[str | None] = mapped_column(String(255))

  issue_date: Mapped[datetime] = mapped_column(Date, nullable=False)
  due_date: Mapped[datetime | None] = mapped_column(Date)

  currency: Mapped[str] = mapped_column(String(3), nullable=False, default="ZAR")
  subtotal: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
  vat_amount: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
  total: Mapped[float] = mapped_column(Numeric(18, 4), default=0)

  status: Mapped[InvoiceStatus] = mapped_column(
    Enum(InvoiceStatus), default=InvoiceStatus.draft, nullable=False
  )

  vat_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)  # percent
  vat_country: Mapped[str | None] = mapped_column(String(2), nullable=True)

  is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
  recurring_interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

  notes: Mapped[str | None] = mapped_column(Text)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )

  lines: Mapped[list["InvoiceLine"]] = relationship(
    back_populates="invoice", cascade="all, delete-orphan"
  )


class InvoiceLine(Base):
  __tablename__ = "invoice_lines"

  id: Mapped[int] = mapped_column(primary_key=True)
  invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"))
  tenant_id: Mapped[int] = mapped_column(index=True)

  description: Mapped[str] = mapped_column(String(255), nullable=False)
  quantity: Mapped[float] = mapped_column(Numeric(18, 4), default=1)
  unit_price: Mapped[float] = mapped_column(Numeric(18, 4), default=0)

  vat_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

  line_total: Mapped[float] = mapped_column(Numeric(18, 4), default=0)

  invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class LineItemTemplate(Base):
  """Reusable line item (product/service) for invoices. Tenant-scoped."""
  __tablename__ = "line_item_templates"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)

  description: Mapped[str] = mapped_column(String(255), nullable=False)
  default_quantity: Mapped[float] = mapped_column(Numeric(18, 4), default=1)
  unit_price: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
  vat_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class AuditLog(Base):
  __tablename__ = "audit_logs"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int | None] = mapped_column(index=True)
  user_id: Mapped[int | None] = mapped_column(index=True)

  action: Mapped[str] = mapped_column(String(100), nullable=False)
  entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
  entity_id: Mapped[str | None] = mapped_column(String(100))
  details: Mapped[str | None] = mapped_column(Text)
  ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv4 / IPv6
  old_values: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
  new_values: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
  prev_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
  hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ExpenseStatus(str, enum.Enum):
  draft = "draft"
  submitted = "submitted"
  approved = "approved"
  rejected = "rejected"


class ExpenseCategory(Base):
  __tablename__ = "expense_categories"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  name: Mapped[str] = mapped_column(String(100), nullable=False)
  tax_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)


class Vendor(Base):
  __tablename__ = "vendors"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  name: Mapped[str] = mapped_column(String(255), nullable=False)
  tax_number: Mapped[str | None] = mapped_column(String(50))
  email: Mapped[str | None] = mapped_column(String(255))
  is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Expense(Base):
  __tablename__ = "expenses"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"), nullable=True)
  category_id: Mapped[int | None] = mapped_column(ForeignKey("expense_categories.id"), nullable=True)

  description: Mapped[str] = mapped_column(String(255), nullable=False)
  date: Mapped[datetime] = mapped_column(Date, nullable=False)
  amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
  tax_amount: Mapped[float] = mapped_column(Numeric(18, 4), default=0)
  currency: Mapped[str] = mapped_column(String(3), default="ZAR")

  status: Mapped[ExpenseStatus] = mapped_column(
    Enum(ExpenseStatus), default=ExpenseStatus.draft, nullable=False
  )

  created_by_user_id: Mapped[int | None] = mapped_column(index=True)
  approved_by_user_id: Mapped[int | None] = mapped_column(index=True)

  is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class ExpenseReceipt(Base):
  __tablename__ = "expense_receipts"

  id: Mapped[int] = mapped_column(primary_key=True)
  expense_id: Mapped[int] = mapped_column(ForeignKey("expenses.id", ondelete="CASCADE"))
  tenant_id: Mapped[int] = mapped_column(index=True)

  file_name: Mapped[str] = mapped_column(String(255), nullable=False)
  content_type: Mapped[str] = mapped_column(String(100), nullable=False)
  file_path: Mapped[str] = mapped_column(String(500), nullable=False)  # path or URL to storage

  uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReceiptUpload(Base):
  """Receipt uploaded standalone; can be AI-extracted and then turned into an expense."""
  __tablename__ = "receipt_uploads"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  expense_id: Mapped[int | None] = mapped_column(ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True, index=True)

  file_name: Mapped[str] = mapped_column(String(255), nullable=False)
  content_type: Mapped[str] = mapped_column(String(100), nullable=False)
  file_path: Mapped[str] = mapped_column(String(500), nullable=False)
  extracted_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

  uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BankAccount(Base):
  __tablename__ = "bank_accounts"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)

  name: Mapped[str] = mapped_column(String(255), nullable=False)
  bank_name: Mapped[str | None] = mapped_column(String(255))
  iban: Mapped[str | None] = mapped_column(String(50))
  currency: Mapped[str] = mapped_column(String(3), default="ZAR")

  opening_balance: Mapped[float] = mapped_column(Numeric(18, 4), default=0)


class BankTransaction(Base):
  __tablename__ = "bank_transactions"

  id: Mapped[int] = mapped_column(primary_key=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  bank_account_id: Mapped[int] = mapped_column(ForeignKey("bank_accounts.id"), index=True)

  date: Mapped[datetime] = mapped_column(Date, nullable=False)
  description: Mapped[str] = mapped_column(String(255), nullable=False)
  amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)  # positive/negative
  balance_after: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)

  matched_invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
  matched_expense_id: Mapped[int | None] = mapped_column(ForeignKey("expenses.id"), nullable=True)

  is_reconciled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)



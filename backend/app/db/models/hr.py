"""
HR / Payroll models: employees, salary history, leave, attendance, payslips.
All tenant-scoped except User linkage.
"""
from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
  String,
  ForeignKey,
  Numeric,
  Integer,
  Date,
  DateTime,
  Time,
  Text,
  Boolean,
  UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.sqlite import JSON

from app.db.base import Base


class Employee(Base):
  __tablename__ = "employees"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)

  employee_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
  first_name: Mapped[str] = mapped_column(String(255), nullable=False)
  last_name: Mapped[str] = mapped_column(String(255), nullable=False)
  email: Mapped[str | None] = mapped_column(String(255))
  id_number: Mapped[str | None] = mapped_column(String(50))
  tax_number: Mapped[str | None] = mapped_column(String(50))
  department: Mapped[str | None] = mapped_column(String(255))
  job_title: Mapped[str | None] = mapped_column(String(255))
  start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
  end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

  bank_name: Mapped[str | None] = mapped_column(String(255))
  bank_account_number: Mapped[str | None] = mapped_column(String(100))
  bank_branch_code: Mapped[str | None] = mapped_column(String(20))

  address: Mapped[str | None] = mapped_column(Text, nullable=True)
  phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
  passport_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

  salary: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
  currency: Mapped[str] = mapped_column(String(3), default="ZAR")

  is_active: Mapped[bool] = mapped_column(Boolean, default=True)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )

  __table_args__ = (UniqueConstraint("tenant_id", "employee_number", name="uq_employee_number_per_tenant"),)


class SalaryHistory(Base):
  __tablename__ = "salary_history"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), index=True)

  effective_from: Mapped[date] = mapped_column(Date, nullable=False)
  amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  currency: Mapped[str] = mapped_column(String(3), default="ZAR")
  reason: Mapped[str | None] = mapped_column(String(255))
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LeaveType(Base):
  __tablename__ = "leave_types"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)

  name: Mapped[str] = mapped_column(String(100), nullable=False)
  days_per_year: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0"))
  carry_over: Mapped[bool] = mapped_column(Boolean, default=False)
  is_active: Mapped[bool] = mapped_column(Boolean, default=True)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LeaveBalance(Base):
  __tablename__ = "leave_balances"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), index=True)
  leave_type_id: Mapped[int] = mapped_column(ForeignKey("leave_types.id", ondelete="CASCADE"), index=True)

  year: Mapped[int] = mapped_column(Integer, nullable=False)
  balance: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0"))
  used: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0"))
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )

  __table_args__ = (UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance"),)


class LeaveRequest(Base):
  __tablename__ = "leave_requests"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), index=True)
  leave_type_id: Mapped[int] = mapped_column(ForeignKey("leave_types.id", ondelete="CASCADE"), index=True)

  start_date: Mapped[date] = mapped_column(Date, nullable=False)
  end_date: Mapped[date] = mapped_column(Date, nullable=False)
  total_days: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
  status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, approved, rejected
  approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
  notes: Mapped[str | None] = mapped_column(Text)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )


class Attendance(Base):
  __tablename__ = "attendance"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), index=True)

  date: Mapped[date] = mapped_column(Date, nullable=False)
  check_in: Mapped[time | None] = mapped_column(Time, nullable=True)
  check_out: Mapped[time | None] = mapped_column(Time, nullable=True)
  status: Mapped[str] = mapped_column(String(20), default="present")  # present, absent, leave, holiday, sick, etc.
  notes: Mapped[str | None] = mapped_column(Text)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
  )

  __table_args__ = (UniqueConstraint("employee_id", "date", name="uq_attendance_per_day"),)


class Payslip(Base):
  __tablename__ = "payslips"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  tenant_id: Mapped[int] = mapped_column(index=True)
  employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), index=True)

  period_start: Mapped[date] = mapped_column(Date, nullable=False)
  period_end: Mapped[date] = mapped_column(Date, nullable=False)
  gross: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  paye: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
  uif_employee: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
  uif_employer: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
  net: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  currency: Mapped[str] = mapped_column(String(3), default="ZAR")
  line_items: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # [{ "label": "...", "amount": ... }]
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

  __table_args__ = (UniqueConstraint("employee_id", "period_start", name="uq_payslip_period"),)

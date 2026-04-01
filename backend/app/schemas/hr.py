from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field, condecimal, constr


# ----- Employee -----
class EmployeeBase(BaseModel):
  employee_number: constr(strip_whitespace=True, max_length=50)
  first_name: constr(strip_whitespace=True, max_length=255)
  last_name: constr(strip_whitespace=True, max_length=255)
  email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  id_number: Optional[constr(max_length=50)] = None
  tax_number: Optional[constr(max_length=50)] = None
  department: Optional[constr(max_length=255)] = None
  job_title: Optional[constr(max_length=255)] = None
  start_date: Optional[date] = None
  end_date: Optional[date] = None
  bank_name: Optional[constr(max_length=255)] = None
  bank_account_number: Optional[constr(max_length=100)] = None
  bank_branch_code: Optional[constr(max_length=20)] = None
  address: Optional[str] = None
  phone: Optional[constr(max_length=50)] = None
  passport_number: Optional[constr(max_length=50)] = None
  salary: Optional[condecimal(max_digits=14, decimal_places=2)] = None
  currency: str = "ZAR"
  is_active: bool = True


class EmployeeCreate(EmployeeBase):
  user_id: Optional[int] = None


class EmployeeUpdate(BaseModel):
  employee_number: Optional[constr(strip_whitespace=True, max_length=50)] = None
  first_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  last_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  id_number: Optional[constr(max_length=50)] = None
  tax_number: Optional[constr(max_length=50)] = None
  department: Optional[constr(max_length=255)] = None
  job_title: Optional[constr(max_length=255)] = None
  start_date: Optional[date] = None
  end_date: Optional[date] = None
  bank_name: Optional[constr(max_length=255)] = None
  bank_account_number: Optional[constr(max_length=100)] = None
  bank_branch_code: Optional[constr(max_length=20)] = None
  address: Optional[str] = None
  phone: Optional[constr(max_length=50)] = None
  passport_number: Optional[constr(max_length=50)] = None
  salary: Optional[condecimal(max_digits=14, decimal_places=2)] = None
  currency: Optional[str] = None
  is_active: Optional[bool] = None
  user_id: Optional[int] = None


class EmployeeRead(EmployeeBase):
  id: int
  tenant_id: int
  user_id: Optional[int] = None
  created_at: datetime
  updated_at: datetime
  avatar_url: Optional[str] = None  # from linked User, set by API

  class Config:
    from_attributes = True


# ----- Salary history -----
class SalaryHistoryCreate(BaseModel):
  employee_id: int
  effective_from: date
  amount: condecimal(max_digits=14, decimal_places=2)
  currency: str = "ZAR"
  reason: Optional[constr(max_length=255)] = None


class SalaryHistoryRead(BaseModel):
  id: int
  tenant_id: int
  employee_id: int
  effective_from: date
  amount: Decimal
  currency: str
  reason: Optional[str] = None
  created_at: datetime

  class Config:
    from_attributes = True


# ----- Leave type -----
class LeaveTypeBase(BaseModel):
  name: constr(strip_whitespace=True, max_length=100)
  days_per_year: condecimal(max_digits=6, decimal_places=2) = Decimal("0")
  carry_over: bool = False
  is_active: bool = True


class LeaveTypeCreate(LeaveTypeBase):
  pass


class LeaveTypeUpdate(BaseModel):
  name: Optional[constr(strip_whitespace=True, max_length=100)] = None
  days_per_year: Optional[condecimal(max_digits=6, decimal_places=2)] = None
  carry_over: Optional[bool] = None
  is_active: Optional[bool] = None


class LeaveTypeRead(LeaveTypeBase):
  id: int
  tenant_id: int
  created_at: datetime

  class Config:
    from_attributes = True


# ----- Leave balance -----
class LeaveBalanceRead(BaseModel):
  id: int
  tenant_id: int
  employee_id: int
  leave_type_id: int
  year: int
  balance: Decimal
  used: Decimal
  leave_type_name: Optional[str] = None

  class Config:
    from_attributes = True


class LeaveBalanceAdjust(BaseModel):
  balance: condecimal(max_digits=8, decimal_places=2)
  used: Optional[condecimal(max_digits=8, decimal_places=2)] = None


# ----- Leave request -----
class LeaveRequestCreate(BaseModel):
  employee_id: Optional[int] = None  # required for admin; ignored when role=employee (uses current)
  leave_type_id: int
  start_date: date
  end_date: date
  total_days: condecimal(max_digits=6, decimal_places=2)
  notes: Optional[str] = None


class LeaveRequestRead(BaseModel):
  id: int
  tenant_id: int
  employee_id: int
  leave_type_id: int
  start_date: date
  end_date: date
  total_days: Decimal
  status: str
  approved_by_id: Optional[int] = None
  notes: Optional[str] = None
  created_at: datetime
  updated_at: datetime
  employee_name: Optional[str] = None
  leave_type_name: Optional[str] = None

  class Config:
    from_attributes = True


class LeaveRequestUpdate(BaseModel):
  status: Optional[str] = None  # approved, rejected
  notes: Optional[str] = None


# ----- Attendance -----
class AttendanceCreate(BaseModel):
  employee_id: int
  date: date
  check_in: Optional[time] = None
  check_out: Optional[time] = None
  status: str = "present"
  notes: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
  employee_id: int
  records: list[dict[str, Any]]


class AttendanceRead(BaseModel):
  id: int
  tenant_id: int
  employee_id: int
  date: date
  check_in: Optional[time] = None
  check_out: Optional[time] = None
  status: str
  notes: Optional[str] = None
  created_at: datetime

  class Config:
    from_attributes = True


# ----- Payslip -----
class PayslipGenerate(BaseModel):
  employee_id: int
  period_start: date
  period_end: date
  gross: Optional[condecimal(max_digits=14, decimal_places=2)] = None
  age_group: Optional[str] = "under65"
  hours_worked_per_month: Optional[condecimal(max_digits=8, decimal_places=2)] = None
  uif_exempt: bool = False


class PayslipRead(BaseModel):
  id: int
  tenant_id: int
  employee_id: int
  period_start: date
  period_end: date
  gross: Decimal
  paye: Decimal
  uif_employee: Decimal
  uif_employer: Decimal
  net: Decimal
  currency: str
  line_items: Optional[list[dict[str, Any]]] = None
  created_at: datetime
  employee_name: Optional[str] = None

  class Config:
    from_attributes = True

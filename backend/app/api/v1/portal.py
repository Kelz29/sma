"""
Employee self-service portal: profile, leave, attendance, payslips.
All endpoints require role=employee and operate on the current employee only.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.hr import Employee
from app.db.models.user import User
from app.schemas.hr import (
  AttendanceRead,
  EmployeeRead,
  EmployeeUpdate,
  LeaveBalanceRead,
  LeaveRequestCreate,
  LeaveRequestRead,
  PayslipRead,
)
from app.db.models.hr import LeaveBalance, LeaveRequest, LeaveType, Attendance, Payslip

router = APIRouter(tags=["portal"])


def _employee_read(emp: Employee) -> EmployeeRead:
  return EmployeeRead(
    id=emp.id,
    tenant_id=emp.tenant_id,
    user_id=emp.user_id,
    employee_number=emp.employee_number,
    first_name=emp.first_name,
    last_name=emp.last_name,
    email=emp.email,
    id_number=emp.id_number,
    tax_number=emp.tax_number,
    department=emp.department,
    job_title=emp.job_title,
    start_date=emp.start_date,
    end_date=emp.end_date,
    bank_name=emp.bank_name,
    bank_account_number=emp.bank_account_number,
    bank_branch_code=emp.bank_branch_code,
    address=getattr(emp, "address", None),
    phone=getattr(emp, "phone", None),
    passport_number=getattr(emp, "passport_number", None),
    salary=emp.salary,
    currency=emp.currency or "ZAR",
    is_active=emp.is_active,
    created_at=emp.created_at,
    updated_at=emp.updated_at,
  )


@router.get("/me", response_model=EmployeeRead)
def get_my_profile(
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  r = _employee_read(employee)
  user = db.query(User).filter(User.id == employee.user_id).first() if employee.user_id else None
  return EmployeeRead(**{**r.model_dump(), "avatar_url": getattr(user, "avatar_url", None) if user else None})


@router.patch("/me", response_model=EmployeeRead)
def update_my_profile(
  payload: EmployeeUpdate,
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  # Allow employee to edit their own contact and banking details (not salary, department, job_title, employee_number, etc.)
  allowed = {
    "first_name", "last_name", "email", "id_number", "passport_number",
    "address", "phone",
    "bank_name", "bank_account_number", "bank_branch_code",
  }
  data = payload.model_dump(exclude_unset=True)
  for k in list(data.keys()):
    if k not in allowed:
      del data[k]
  for k, v in data.items():
    setattr(employee, k, v)
  db.commit()
  db.refresh(employee)
  r = _employee_read(employee)
  user = db.query(User).filter(User.id == employee.user_id).first() if employee.user_id else None
  return EmployeeRead(**{**r.model_dump(), "avatar_url": getattr(user, "avatar_url", None) if user else None})


@router.get("/leave/balances", response_model=list[LeaveBalanceRead])
def get_my_leave_balances(
  year: int | None = None,
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  from app.db.models.hr import LeaveType
  q = (
    db.query(LeaveBalance, LeaveType)
    .join(LeaveType, LeaveBalance.leave_type_id == LeaveType.id)
    .filter(LeaveBalance.tenant_id == employee.tenant_id, LeaveBalance.employee_id == employee.id)
  )
  if year is not None:
    q = q.filter(LeaveBalance.year == year)
  rows = q.order_by(LeaveBalance.year.desc(), LeaveType.name).all()
  return [
    LeaveBalanceRead(
      id=lb.id,
      tenant_id=lb.tenant_id,
      employee_id=lb.employee_id,
      leave_type_id=lb.leave_type_id,
      year=lb.year,
      balance=lb.balance,
      used=lb.used,
      leave_type_name=lt.name,
    )
    for lb, lt in rows
  ]


@router.get("/leave/requests", response_model=list[LeaveRequestRead])
def get_my_leave_requests(
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  q = (
    db.query(LeaveRequest, LeaveType)
    .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
    .filter(LeaveRequest.tenant_id == employee.tenant_id, LeaveRequest.employee_id == employee.id)
  )
  rows = q.order_by(LeaveRequest.start_date.desc()).all()
  return [
    LeaveRequestRead(
      id=lr.id,
      tenant_id=lr.tenant_id,
      employee_id=lr.employee_id,
      leave_type_id=lr.leave_type_id,
      start_date=lr.start_date,
      end_date=lr.end_date,
      total_days=lr.total_days,
      status=lr.status,
      approved_by_id=lr.approved_by_id,
      notes=lr.notes,
      created_at=lr.created_at,
      updated_at=lr.updated_at,
      employee_name=f"{employee.first_name} {employee.last_name}".strip(),
      leave_type_name=lt.name,
    )
    for lr, lt in rows
  ]


@router.post("/leave/requests", response_model=LeaveRequestRead, status_code=status.HTTP_201_CREATED)
def create_my_leave_request(
  payload: LeaveRequestCreate,
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  lt = (
    db.query(LeaveType)
    .filter(LeaveType.id == payload.leave_type_id, LeaveType.tenant_id == employee.tenant_id)
    .first()
  )
  if not lt:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found")
  lr = LeaveRequest(
    tenant_id=employee.tenant_id,
    employee_id=employee.id,
    leave_type_id=payload.leave_type_id,
    start_date=payload.start_date,
    end_date=payload.end_date,
    total_days=payload.total_days,
    status="pending",
    notes=payload.notes,
  )
  db.add(lr)
  db.commit()
  db.refresh(lr)
  return LeaveRequestRead(
    id=lr.id,
    tenant_id=lr.tenant_id,
    employee_id=lr.employee_id,
    leave_type_id=lr.leave_type_id,
    start_date=lr.start_date,
    end_date=lr.end_date,
    total_days=lr.total_days,
    status=lr.status,
    approved_by_id=lr.approved_by_id,
    notes=lr.notes,
    created_at=lr.created_at,
    updated_at=lr.updated_at,
    employee_name=f"{employee.first_name} {employee.last_name}".strip(),
    leave_type_name=lt.name,
  )


@router.get("/attendance", response_model=list[AttendanceRead])
def get_my_attendance(
  from_date: date | None = None,
  to_date: date | None = None,
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  q = (
    db.query(Attendance)
    .filter(Attendance.tenant_id == employee.tenant_id, Attendance.employee_id == employee.id)
  )
  if from_date is not None:
    q = q.filter(Attendance.date >= from_date)
  if to_date is not None:
    q = q.filter(Attendance.date <= to_date)
  rows = q.order_by(Attendance.date.desc()).all()
  return [
    AttendanceRead(
      id=r.id,
      tenant_id=r.tenant_id,
      employee_id=r.employee_id,
      date=r.date,
      check_in=r.check_in,
      check_out=r.check_out,
      status=r.status,
      notes=r.notes,
      created_at=r.created_at,
    )
    for r in rows
  ]


@router.get("/payslips", response_model=list[PayslipRead])
def get_my_payslips(
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  rows = (
    db.query(Payslip)
    .filter(Payslip.tenant_id == employee.tenant_id, Payslip.employee_id == employee.id)
    .order_by(Payslip.period_start.desc())
    .all()
  )
  return [
    PayslipRead(
      id=p.id,
      tenant_id=p.tenant_id,
      employee_id=p.employee_id,
      period_start=p.period_start,
      period_end=p.period_end,
      gross=p.gross,
      paye=p.paye,
      uif_employee=p.uif_employee,
      uif_employer=p.uif_employer,
      net=p.net,
      currency=p.currency or "ZAR",
      line_items=p.line_items if isinstance(p.line_items, list) else None,
      created_at=p.created_at,
      employee_name=f"{employee.first_name} {employee.last_name}".strip(),
    )
    for p in rows
  ]


@router.get("/payslips/{payslip_id}/pdf")
def get_my_payslip_pdf(
  payslip_id: int,
  theme: str = Query("classic", description="PDF layout: classic, modern, or minimal"),
  db: Session = Depends(deps.get_db),
  employee: Employee = Depends(deps.get_current_employee),
):
  from fastapi.responses import StreamingResponse
  from app.db.models.tenant import Tenant
  from app.utils.payslip_html import build_payslip_html
  from app.utils.pdf import render_invoice_pdf

  p = (
    db.query(Payslip)
    .filter(
      Payslip.id == payslip_id,
      Payslip.tenant_id == employee.tenant_id,
      Payslip.employee_id == employee.id,
    )
    .first()
  )
  if not p:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")
  tenant = db.query(Tenant).filter(Tenant.id == employee.tenant_id).first()
  company_name = tenant.name if tenant else "Company"
  company_address = getattr(tenant, "address", None) or None
  company_registration_number = getattr(tenant, "company_registration_number", None) or None
  company_logo_url = getattr(tenant, "logo_url", None) if tenant else None
  from app.utils.payroll import sa_tax_year_start, sum_payslip_ytd

  year_start = sa_tax_year_start(p.period_start)
  ytd_slips = (
    db.query(Payslip)
    .filter(
      Payslip.tenant_id == employee.tenant_id,
      Payslip.employee_id == employee.id,
      Payslip.period_start >= year_start,
      Payslip.period_start <= p.period_start,
    )
    .all()
  )
  ytd_tax, ytd_earnings = sum_payslip_ytd(ytd_slips, through_period_start=p.period_start)
  html = build_payslip_html(
    company_name=company_name,
    company_registration_number=company_registration_number,
    employee_name=f"{employee.first_name} {employee.last_name}".strip(),
    employee_number=employee.employee_number,
    period_start=p.period_start,
    period_end=p.period_end,
    gross=p.gross,
    paye=p.paye,
    uif_employee=p.uif_employee,
    uif_employer=p.uif_employer,
    net=p.net,
    currency=p.currency or "ZAR",
    line_items=p.line_items if isinstance(p.line_items, list) else None,
    company_address=company_address,
    company_logo_url=company_logo_url,
    theme=theme,
    ytd_tax=ytd_tax,
    ytd_earnings=ytd_earnings,
  )
  pdf_bytes = render_invoice_pdf(html_body=html)
  return StreamingResponse(
    iter([pdf_bytes]),
    media_type="application/pdf",
    headers={"Content-Disposition": f"inline; filename=payslip-{p.id}.pdf"},
  )

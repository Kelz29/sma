from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.hr import Employee, SalaryHistory
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.hr import (
  EmployeeCreate,
  EmployeeRead,
  EmployeeUpdate,
  SalaryHistoryCreate,
  SalaryHistoryRead,
)

router = APIRouter(tags=["employees"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


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


@router.get("/", response_model=list[EmployeeRead])
def list_employees(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  employees = (
    db.query(Employee)
    .filter(Employee.tenant_id == tenant_id)
    .order_by(Employee.last_name, Employee.first_name)
    .all()
  )
  return [_employee_read(e) for e in employees]


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(
  employee_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  emp = (
    db.query(Employee)
    .filter(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    .first()
  )
  if not emp:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
  return _employee_read(emp)


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(
  payload: EmployeeCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  existing = (
    db.query(Employee)
    .filter(
      Employee.tenant_id == tenant_id,
      Employee.employee_number == payload.employee_number,
    )
    .first()
  )
  if existing:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Employee number already exists",
    )
  emp = Employee(
    tenant_id=tenant_id,
    user_id=payload.user_id,
    employee_number=payload.employee_number,
    first_name=payload.first_name,
    last_name=payload.last_name,
    email=payload.email,
    id_number=payload.id_number,
    tax_number=payload.tax_number,
    department=payload.department,
    job_title=payload.job_title,
    start_date=payload.start_date,
    end_date=payload.end_date,
    bank_name=payload.bank_name,
    bank_account_number=payload.bank_account_number,
    bank_branch_code=payload.bank_branch_code,
    salary=payload.salary,
    currency=payload.currency or "ZAR",
    is_active=payload.is_active,
  )
  db.add(emp)
  db.commit()
  db.refresh(emp)
  return _employee_read(emp)


@router.patch("/{employee_id}", response_model=EmployeeRead)
def update_employee(
  employee_id: int,
  payload: EmployeeUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  emp = (
    db.query(Employee)
    .filter(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    .first()
  )
  if not emp:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
  for k, v in payload.model_dump(exclude_unset=True).items():
    setattr(emp, k, v)
  db.commit()
  db.refresh(emp)
  return _employee_read(emp)


@router.get("/{employee_id}/salary-history", response_model=list[SalaryHistoryRead])
def list_salary_history(
  employee_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  emp = (
    db.query(Employee)
    .filter(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    .first()
  )
  if not emp:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
  rows = (
    db.query(SalaryHistory)
    .filter(
      SalaryHistory.tenant_id == tenant_id,
      SalaryHistory.employee_id == employee_id,
    )
    .order_by(SalaryHistory.effective_from.desc())
    .all()
  )
  return [
    SalaryHistoryRead(
      id=r.id,
      tenant_id=r.tenant_id,
      employee_id=r.employee_id,
      effective_from=r.effective_from,
      amount=r.amount,
      currency=r.currency,
      reason=r.reason,
      created_at=r.created_at,
    )
    for r in rows
  ]


@router.post("/{employee_id}/salary-history", response_model=SalaryHistoryRead, status_code=status.HTTP_201_CREATED)
def create_salary_history(
  employee_id: int,
  payload: SalaryHistoryCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  emp = (
    db.query(Employee)
    .filter(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    .first()
  )
  if not emp:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
  if payload.employee_id != employee_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="employee_id mismatch")
  sh = SalaryHistory(
    tenant_id=tenant_id,
    employee_id=employee_id,
    effective_from=payload.effective_from,
    amount=payload.amount,
    currency=payload.currency or "ZAR",
    reason=payload.reason,
  )
  db.add(sh)
  db.commit()
  db.refresh(sh)
  return SalaryHistoryRead(
    id=sh.id,
    tenant_id=sh.tenant_id,
    employee_id=sh.employee_id,
    effective_from=sh.effective_from,
    amount=sh.amount,
    currency=sh.currency,
    reason=sh.reason,
    created_at=sh.created_at,
  )

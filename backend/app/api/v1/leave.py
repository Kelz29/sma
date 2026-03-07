from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.hr import Employee, LeaveBalance, LeaveRequest, LeaveType
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.hr import (
  LeaveBalanceAdjust,
  LeaveBalanceRead,
  LeaveRequestCreate,
  LeaveRequestRead,
  LeaveRequestUpdate,
  LeaveTypeCreate,
  LeaveTypeRead,
  LeaveTypeUpdate,
)

router = APIRouter(tags=["leave"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("/types", response_model=list[LeaveTypeRead])
def list_leave_types(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr", "employee"])),
):
  tenant_id = _get_tenant_id_or_400()
  types_ = (
    db.query(LeaveType)
    .filter(LeaveType.tenant_id == tenant_id, LeaveType.is_active == True)
    .order_by(LeaveType.name)
    .all()
  )
  return [
    LeaveTypeRead(
      id=t.id,
      tenant_id=t.tenant_id,
      name=t.name,
      days_per_year=t.days_per_year,
      carry_over=t.carry_over,
      is_active=t.is_active,
      created_at=t.created_at,
    )
    for t in types_
  ]


@router.post("/types", response_model=LeaveTypeRead, status_code=status.HTTP_201_CREATED)
def create_leave_type(
  payload: LeaveTypeCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  lt = LeaveType(
    tenant_id=tenant_id,
    name=payload.name,
    days_per_year=payload.days_per_year,
    carry_over=payload.carry_over,
    is_active=payload.is_active,
  )
  db.add(lt)
  db.commit()
  db.refresh(lt)
  return LeaveTypeRead(
    id=lt.id,
    tenant_id=lt.tenant_id,
    name=lt.name,
    days_per_year=lt.days_per_year,
    carry_over=lt.carry_over,
    is_active=lt.is_active,
    created_at=lt.created_at,
  )


@router.patch("/types/{leave_type_id}", response_model=LeaveTypeRead)
def update_leave_type(
  leave_type_id: int,
  payload: LeaveTypeUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  lt = (
    db.query(LeaveType)
    .filter(LeaveType.id == leave_type_id, LeaveType.tenant_id == tenant_id)
    .first()
  )
  if not lt:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found")
  for k, v in payload.model_dump(exclude_unset=True).items():
    setattr(lt, k, v)
  db.commit()
  db.refresh(lt)
  return LeaveTypeRead(
    id=lt.id,
    tenant_id=lt.tenant_id,
    name=lt.name,
    days_per_year=lt.days_per_year,
    carry_over=lt.carry_over,
    is_active=lt.is_active,
    created_at=lt.created_at,
  )


@router.post("/balances", response_model=LeaveBalanceRead, status_code=status.HTTP_201_CREATED)
def create_leave_balance(
  employee_id: int,
  leave_type_id: int,
  year: int,
  payload: LeaveBalanceAdjust,
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
  lt = (
    db.query(LeaveType)
    .filter(LeaveType.id == leave_type_id, LeaveType.tenant_id == tenant_id)
    .first()
  )
  if not lt:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found")
  existing = (
    db.query(LeaveBalance)
    .filter(
      LeaveBalance.tenant_id == tenant_id,
      LeaveBalance.employee_id == employee_id,
      LeaveBalance.leave_type_id == leave_type_id,
      LeaveBalance.year == year,
    )
    .first()
  )
  if existing:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Balance already exists for this employee/type/year")
  lb = LeaveBalance(
    tenant_id=tenant_id,
    employee_id=employee_id,
    leave_type_id=leave_type_id,
    year=year,
    balance=payload.balance,
    used=payload.used or 0,
  )
  db.add(lb)
  db.commit()
  db.refresh(lb)
  return LeaveBalanceRead(
    id=lb.id,
    tenant_id=lb.tenant_id,
    employee_id=lb.employee_id,
    leave_type_id=lb.leave_type_id,
    year=lb.year,
    balance=lb.balance,
    used=lb.used,
    leave_type_name=lt.name,
  )


@router.get("/balances", response_model=list[LeaveBalanceRead])
def list_leave_balances(
  employee_id: int,
  year: int | None = None,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr", "employee"])),
):
  tenant_id = _get_tenant_id_or_400()
  if ctx["tenant_user"].role == "employee":
    emp = (
      db.query(Employee)
      .filter(Employee.tenant_id == tenant_id, Employee.user_id == ctx["user"].id)
      .first()
    )
    if not emp or emp.id != employee_id:
      return []
  q = (
    db.query(LeaveBalance, LeaveType)
    .join(LeaveType, LeaveBalance.leave_type_id == LeaveType.id)
    .filter(LeaveBalance.tenant_id == tenant_id, LeaveBalance.employee_id == employee_id)
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


@router.put("/balances/{balance_id}")
def adjust_leave_balance(
  balance_id: int,
  payload: LeaveBalanceAdjust,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  lb = (
    db.query(LeaveBalance)
    .filter(LeaveBalance.id == balance_id, LeaveBalance.tenant_id == tenant_id)
    .first()
  )
  if not lb:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave balance not found")
  lb.balance = payload.balance
  if payload.used is not None:
    lb.used = payload.used
  db.commit()
  return {"ok": True}


@router.get("/requests", response_model=list[LeaveRequestRead])
def list_leave_requests(
  employee_id: int | None = None,
  status_filter: str | None = None,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr", "employee"])),
):
  tenant_id = _get_tenant_id_or_400()
  if ctx["tenant_user"].role == "employee":
    emp = (
      db.query(Employee)
      .filter(Employee.tenant_id == tenant_id, Employee.user_id == ctx["user"].id)
      .first()
    )
    if emp:
      employee_id = emp.id
    else:
      return []
  q = (
    db.query(LeaveRequest, LeaveType, Employee)
    .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
    .join(Employee, LeaveRequest.employee_id == Employee.id)
    .filter(LeaveRequest.tenant_id == tenant_id)
  )
  if employee_id is not None:
    q = q.filter(LeaveRequest.employee_id == employee_id)
  if status_filter:
    q = q.filter(LeaveRequest.status == status_filter)
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
      employee_name=f"{emp.first_name} {emp.last_name}".strip(),
      leave_type_name=lt.name,
    )
    for lr, lt, emp in rows
  ]


@router.post("/requests", response_model=LeaveRequestRead, status_code=status.HTTP_201_CREATED)
def create_leave_request(
  payload: LeaveRequestCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr", "employee"])),
):
  tenant_id = _get_tenant_id_or_400()
  role = ctx["tenant_user"].role
  if role == "employee":
    emp = (
      db.query(Employee)
      .filter(
        Employee.tenant_id == tenant_id,
        Employee.user_id == ctx["user"].id,
      )
      .first()
    )
    if not emp:
      raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee profile not found")
    employee_id = emp.id
  else:
    if payload.employee_id is None:
      raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="employee_id required")
    emp = (
      db.query(Employee)
      .filter(Employee.id == payload.employee_id, Employee.tenant_id == tenant_id)
      .first()
    )
    if not emp:
      raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    employee_id = emp.id

  lt = (
    db.query(LeaveType)
    .filter(LeaveType.id == payload.leave_type_id, LeaveType.tenant_id == tenant_id)
    .first()
  )
  if not lt:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found")

  lr = LeaveRequest(
    tenant_id=tenant_id,
    employee_id=employee_id,
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
    employee_name=f"{emp.first_name} {emp.last_name}".strip(),
    leave_type_name=lt.name,
  )


@router.patch("/requests/{request_id}", response_model=LeaveRequestRead)
def update_leave_request(
  request_id: int,
  payload: LeaveRequestUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  lr = (
    db.query(LeaveRequest)
    .filter(LeaveRequest.id == request_id, LeaveRequest.tenant_id == tenant_id)
    .first()
  )
  if not lr:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
  if payload.status is not None:
    lr.status = payload.status
    if payload.status in ("approved", "rejected"):
      lr.approved_by_id = ctx["user"].id
  if payload.notes is not None:
    lr.notes = payload.notes
  db.commit()
  db.refresh(lr)
  emp = db.query(Employee).filter(Employee.id == lr.employee_id).first()
  lt = db.query(LeaveType).filter(LeaveType.id == lr.leave_type_id).first()
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
    employee_name=f"{emp.first_name} {emp.last_name}".strip() if emp else None,
    leave_type_name=lt.name if lt else None,
  )

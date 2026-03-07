from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.hr import Attendance, Employee
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.hr import AttendanceBulkCreate, AttendanceCreate, AttendanceRead

router = APIRouter(tags=["attendance"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("/", response_model=list[AttendanceRead])
def list_attendance(
  employee_id: int,
  from_date: date | None = None,
  to_date: date | None = None,
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
    db.query(Attendance)
    .filter(Attendance.tenant_id == tenant_id, Attendance.employee_id == employee_id)
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


@router.post("/", response_model=AttendanceRead, status_code=status.HTTP_201_CREATED)
def create_attendance(
  payload: AttendanceCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  emp = (
    db.query(Employee)
    .filter(Employee.id == payload.employee_id, Employee.tenant_id == tenant_id)
    .first()
  )
  if not emp:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
  existing = (
    db.query(Attendance)
    .filter(
      Attendance.tenant_id == tenant_id,
      Attendance.employee_id == payload.employee_id,
      Attendance.date == payload.date,
    )
    .first()
  )
  if existing:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Attendance already recorded for this date",
    )
  att = Attendance(
    tenant_id=tenant_id,
    employee_id=payload.employee_id,
    date=payload.date,
    check_in=payload.check_in,
    check_out=payload.check_out,
    status=payload.status,
    notes=payload.notes,
  )
  db.add(att)
  db.commit()
  db.refresh(att)
  return AttendanceRead(
    id=att.id,
    tenant_id=att.tenant_id,
    employee_id=att.employee_id,
    date=att.date,
    check_in=att.check_in,
    check_out=att.check_out,
    status=att.status,
    notes=att.notes,
    created_at=att.created_at,
  )


@router.put("/{attendance_id}", response_model=AttendanceRead)
def update_attendance(
  attendance_id: int,
  payload: AttendanceCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  att = (
    db.query(Attendance)
    .filter(Attendance.id == attendance_id, Attendance.tenant_id == tenant_id)
    .first()
  )
  if not att:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found")
  att.date = payload.date
  att.check_in = payload.check_in
  att.check_out = payload.check_out
  att.status = payload.status
  att.notes = payload.notes
  # employee_id is not updated
  db.commit()
  db.refresh(att)
  return AttendanceRead(
    id=att.id,
    tenant_id=att.tenant_id,
    employee_id=att.employee_id,
    date=att.date,
    check_in=att.check_in,
    check_out=att.check_out,
    status=att.status,
    notes=att.notes,
    created_at=att.created_at,
  )


@router.post("/bulk")
def bulk_create_attendance(
  payload: AttendanceBulkCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "hr"])),
):
  tenant_id = _get_tenant_id_or_400()
  emp = (
    db.query(Employee)
    .filter(Employee.id == payload.employee_id, Employee.tenant_id == tenant_id)
    .first()
  )
  if not emp:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
  created = 0
  for rec in payload.records:
    dt = rec.get("date")
    if isinstance(dt, str):
      from datetime import datetime
      dt = datetime.strptime(dt, "%Y-%m-%d").date()
    existing = (
      db.query(Attendance)
      .filter(
        Attendance.tenant_id == tenant_id,
        Attendance.employee_id == payload.employee_id,
        Attendance.date == dt,
      )
      .first()
    )
    if existing:
      continue
    check_in = rec.get("check_in")
    check_out = rec.get("check_out")
    if isinstance(check_in, str):
      from datetime import datetime as dt_parser
      check_in = dt_parser.strptime(check_in, "%H:%M").time() if check_in else None
    if isinstance(check_out, str):
      from datetime import datetime as dt_parser
      check_out = dt_parser.strptime(check_out, "%H:%M").time() if check_out else None
    att = Attendance(
      tenant_id=tenant_id,
      employee_id=payload.employee_id,
      date=dt,
      check_in=check_in,
      check_out=check_out,
      status=rec.get("status", "present"),
      notes=rec.get("notes"),
    )
    db.add(att)
    created += 1
  db.commit()
  return {"created": created}

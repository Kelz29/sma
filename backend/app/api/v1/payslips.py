from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.hr import Employee, Payslip
from app.db.models.tenant import Tenant
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.hr import PayslipGenerate, PayslipRead
from app.utils.payroll import net_after_paye_uif
from app.utils.payslip_html import build_payslip_html
from app.utils.pdf import render_invoice_pdf

router = APIRouter(tags=["payslips"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


def _payslip_read(p: Payslip, employee_name: str | None = None) -> PayslipRead:
  return PayslipRead(
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
    employee_name=employee_name,
  )


@router.get("/", response_model=list[PayslipRead])
def list_payslips(
  employee_id: int | None = None,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
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
  q = db.query(Payslip).filter(Payslip.tenant_id == tenant_id)
  if employee_id is not None:
    q = q.filter(Payslip.employee_id == employee_id)
  rows = q.order_by(Payslip.period_start.desc()).all()
  emp_ids = {r.employee_id for r in rows}
  employees = {e.id: f"{e.first_name} {e.last_name}".strip() for e in db.query(Employee).filter(Employee.id.in_(emp_ids)).all()} if emp_ids else {}
  return [_payslip_read(r, employees.get(r.employee_id)) for r in rows]


@router.get("/{payslip_id}", response_model=PayslipRead)
def get_payslip(
  payslip_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  role = ctx["tenant_user"].role
  p = (
    db.query(Payslip)
    .filter(Payslip.id == payslip_id, Payslip.tenant_id == tenant_id)
    .first()
  )
  if not p:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")
  if role == "employee":
    emp = (
      db.query(Employee)
      .filter(Employee.tenant_id == tenant_id, Employee.user_id == ctx["user"].id)
      .first()
    )
    if not emp or emp.id != p.employee_id:
      raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
  emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
  return _payslip_read(p, f"{emp.first_name} {emp.last_name}".strip() if emp else None)


@router.post("/generate", response_model=PayslipRead, status_code=status.HTTP_201_CREATED)
def generate_payslip(
  payload: PayslipGenerate,
  db: Session = Depends(deps.get_db),
  response: Response = None,
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  emp = (
    db.query(Employee)
    .filter(Employee.id == payload.employee_id, Employee.tenant_id == tenant_id)
    .first()
  )
  if not emp:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
  gross = payload.gross if payload.gross is not None else emp.salary
  if gross is None or gross <= 0:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gross pay required (set on employee or in request)")
  gross = Decimal(str(gross))
  age_group = (payload.age_group or "under65").strip() or "under65"
  if age_group not in ("under65", "65-74", "75+"):
    age_group = "under65"
  hours_worked_per_month = (
    Decimal(str(payload.hours_worked_per_month))
    if payload.hours_worked_per_month is not None
    else None
  )
  paye, uif_emp, uif_emplr, net = net_after_paye_uif(
    gross,
    age_group,
    hours_worked_per_month=hours_worked_per_month,
    uif_exempt=bool(payload.uif_exempt),
  )
  existing = (
    db.query(Payslip)
    .filter(
      Payslip.tenant_id == tenant_id,
      Payslip.employee_id == payload.employee_id,
      Payslip.period_start == payload.period_start,
    )
    .first()
  )
  line_items = [
    {"label": "Gross pay", "amount": float(gross)},
    {"label": "PAYE", "amount": -float(paye)},
    {"label": "UIF (employee)", "amount": -float(uif_emp)},
  ]
  if existing:
    existing.period_end = payload.period_end
    existing.gross = gross
    existing.paye = paye
    existing.uif_employee = uif_emp
    existing.uif_employer = uif_emplr
    existing.net = net
    existing.currency = emp.currency or "ZAR"
    existing.line_items = line_items
    db.commit()
    db.refresh(existing)
    if response is not None:
      response.status_code = status.HTTP_200_OK
    return _payslip_read(existing, f"{emp.first_name} {emp.last_name}".strip())

  p = Payslip(
    tenant_id=tenant_id,
    employee_id=payload.employee_id,
    period_start=payload.period_start,
    period_end=payload.period_end,
    gross=gross,
    paye=paye,
    uif_employee=uif_emp,
    uif_employer=uif_emplr,
    net=net,
    currency=emp.currency or "ZAR",
    line_items=line_items,
  )
  db.add(p)
  db.commit()
  db.refresh(p)
  return _payslip_read(p, f"{emp.first_name} {emp.last_name}".strip())


@router.get("/{payslip_id}/pdf")
def get_payslip_pdf(
  payslip_id: int,
  theme: str = Query("classic", description="PDF layout: classic, modern, or minimal"),
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  role = ctx["tenant_user"].role
  p = (
    db.query(Payslip)
    .filter(Payslip.id == payslip_id, Payslip.tenant_id == tenant_id)
    .first()
  )
  if not p:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")
  if role == "employee":
    emp = (
      db.query(Employee)
      .filter(Employee.tenant_id == tenant_id, Employee.user_id == ctx["user"].id)
      .first()
    )
    if not emp or emp.id != p.employee_id:
      raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
  emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
  tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
  company_name = tenant.name if tenant else "Company"
  company_address = getattr(tenant, "address", None) or None
  company_registration_number = getattr(tenant, "company_registration_number", None) or None
  company_logo_url = getattr(tenant, "logo_url", None) if tenant else None
  html = build_payslip_html(
    company_name=company_name,
    company_registration_number=company_registration_number,
    employee_name=f"{emp.first_name} {emp.last_name}".strip() if emp else "—",
    employee_number=emp.employee_number if emp else "—",
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
  )
  pdf_bytes = render_invoice_pdf(html_body=html)
  return StreamingResponse(
    iter([pdf_bytes]),
    media_type="application/pdf",
    headers={"Content-Disposition": f"inline; filename=payslip-{p.id}.pdf"},
  )

"""Reusable line item templates for invoices (products/services)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.accounting import LineItemTemplate
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.accounting import (
  LineItemTemplateCreate,
  LineItemTemplateRead,
  LineItemTemplateUpdate,
)

router = APIRouter(tags=["line-item-templates"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("/", response_model=list[LineItemTemplateRead])
def list_line_item_templates(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  templates = (
    db.query(LineItemTemplate)
    .filter(LineItemTemplate.tenant_id == tenant_id)
    .order_by(LineItemTemplate.description)
    .all()
  )
  return templates


@router.post("/", response_model=LineItemTemplateRead, status_code=status.HTTP_201_CREATED)
def create_line_item_template(
  payload: LineItemTemplateCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  template = LineItemTemplate(
    tenant_id=tenant_id,
    description=payload.description,
    default_quantity=payload.default_quantity,
    unit_price=payload.unit_price,
    vat_rate=payload.vat_rate,
  )
  db.add(template)
  db.commit()
  db.refresh(template)
  return template


@router.get("/{template_id}", response_model=LineItemTemplateRead)
def get_line_item_template(
  template_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  template = (
    db.query(LineItemTemplate)
    .filter(LineItemTemplate.tenant_id == tenant_id, LineItemTemplate.id == template_id)
    .first()
  )
  if not template:
    raise HTTPException(status_code=404, detail="Line item template not found")
  return template


@router.patch("/{template_id}", response_model=LineItemTemplateRead)
def update_line_item_template(
  template_id: int,
  payload: LineItemTemplateUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  template = (
    db.query(LineItemTemplate)
    .filter(LineItemTemplate.tenant_id == tenant_id, LineItemTemplate.id == template_id)
    .first()
  )
  if not template:
    raise HTTPException(status_code=404, detail="Line item template not found")
  if payload.description is not None:
    template.description = payload.description
  if payload.default_quantity is not None:
    template.default_quantity = payload.default_quantity
  if payload.unit_price is not None:
    template.unit_price = payload.unit_price
  if payload.vat_rate is not None:
    template.vat_rate = payload.vat_rate
  db.add(template)
  db.commit()
  db.refresh(template)
  return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_line_item_template(
  template_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "sales"])),
):
  tenant_id = _get_tenant_id_or_400()
  template = (
    db.query(LineItemTemplate)
    .filter(LineItemTemplate.tenant_id == tenant_id, LineItemTemplate.id == template_id)
    .first()
  )
  if not template:
    raise HTTPException(status_code=404, detail="Line item template not found")
  db.delete(template)
  db.commit()
  return None

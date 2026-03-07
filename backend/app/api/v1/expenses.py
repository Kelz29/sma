import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.db.models.accounting import (
  Expense,
  ExpenseCategory,
  ExpenseReceipt,
  ExpenseStatus,
  ReceiptUpload,
  Vendor,
)
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.expenses_banking import (
  CreateExpenseFromReceiptRequest,
  ExpenseCategoryCreate,
  ExpenseCategoryRead,
  VendorCreate,
  VendorRead,
  ExpenseCreate,
  ExpenseRead,
  ExpenseUpdate,
  ReceiptUploadRead,
)
from app.utils.audit import log_audit
from app.utils.receipt_extract import extract_receipt_data

router = APIRouter(tags=["expenses"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("/categories", response_model=list[ExpenseCategoryRead])
def list_categories(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  cats = db.query(ExpenseCategory).filter(ExpenseCategory.tenant_id == tenant_id).all()
  return cats


@router.post("/categories", response_model=ExpenseCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
  payload: ExpenseCategoryCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  cat = ExpenseCategory(
    tenant_id=tenant_id,
    name=payload.name,
    tax_rate=payload.tax_rate,
  )
  db.add(cat)
  db.commit()
  db.refresh(cat)
  return cat


@router.get("/vendors", response_model=list[VendorRead])
def list_vendors(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  vendors = db.query(Vendor).filter(Vendor.tenant_id == tenant_id).all()
  return vendors


@router.post("/vendors", response_model=VendorRead, status_code=status.HTTP_201_CREATED)
def create_vendor(
  payload: VendorCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  vendor = Vendor(
    tenant_id=tenant_id,
    name=payload.name,
    tax_number=payload.tax_number,
    email=payload.email,
    is_active=payload.is_active,
  )
  db.add(vendor)
  db.commit()
  db.refresh(vendor)
  return vendor


@router.get("/", response_model=list[ExpenseRead])
def list_expenses(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  exps = (
    db.query(Expense)
    .filter(Expense.tenant_id == tenant_id, Expense.is_deleted.is_(False))
    .order_by(Expense.date.desc())
    .all()
  )
  return exps


@router.post("/", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
  payload: ExpenseCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()

  if payload.vendor_id:
    vendor = (
      db.query(Vendor)
      .filter(Vendor.tenant_id == tenant_id, Vendor.id == payload.vendor_id, Vendor.is_active.is_(True))
      .first()
    )
    if not vendor:
      raise HTTPException(status_code=400, detail="Vendor not found")

  if payload.category_id:
    cat = (
      db.query(ExpenseCategory)
      .filter(ExpenseCategory.tenant_id == tenant_id, ExpenseCategory.id == payload.category_id)
      .first()
    )
    if not cat:
      raise HTTPException(status_code=400, detail="Category not found")

  expense = Expense(
    tenant_id=tenant_id,
    vendor_id=payload.vendor_id,
    category_id=payload.category_id,
    description=payload.description,
    date=payload.date,
    amount=payload.amount,
    tax_amount=payload.tax_amount,
    currency=payload.currency,
    status=ExpenseStatus.submitted,
    created_by_user_id=ctx["user"].id,
  )
  db.add(expense)
  db.flush()

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="create_expense",
    entity_type="Expense",
    entity_id=str(expense.id),
    details=f"Created expense {expense.id}",
  )

  db.commit()
  db.refresh(expense)
  return expense


@router.put("/{expense_id}", response_model=ExpenseRead)
def update_expense(
  expense_id: int,
  payload: ExpenseUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  expense = (
    db.query(Expense)
    .filter(Expense.tenant_id == tenant_id, Expense.id == expense_id, Expense.is_deleted.is_(False))
    .first()
  )
  if not expense:
    raise HTTPException(status_code=404, detail="Expense not found")

  before = {
    "vendor_id": expense.vendor_id,
    "category_id": expense.category_id,
    "description": expense.description,
    "date": str(expense.date),
    "amount": float(expense.amount),
    "tax_amount": float(expense.tax_amount),
    "status": expense.status.value,
  }
  if payload.vendor_id is not None:
    vendor = (
      db.query(Vendor)
      .filter(Vendor.tenant_id == tenant_id, Vendor.id == payload.vendor_id, Vendor.is_active.is_(True))
      .first()
    )
    if not vendor:
      raise HTTPException(status_code=400, detail="Vendor not found")
    expense.vendor_id = payload.vendor_id

  if payload.category_id is not None:
    cat = (
      db.query(ExpenseCategory)
      .filter(ExpenseCategory.tenant_id == tenant_id, ExpenseCategory.id == payload.category_id)
      .first()
    )
    if not cat:
      raise HTTPException(status_code=400, detail="Category not found")
    expense.category_id = payload.category_id

  if payload.description is not None:
    expense.description = payload.description
  if payload.date is not None:
    expense.date = payload.date
  if payload.amount is not None:
    expense.amount = payload.amount
  if payload.tax_amount is not None:
    expense.tax_amount = payload.tax_amount
  if payload.status is not None:
    if payload.status not in {s.value for s in ExpenseStatus}:
      raise HTTPException(status_code=400, detail="Invalid expense status")
    expense.status = ExpenseStatus(payload.status)

  db.add(expense)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="update_expense",
    entity_type="Expense",
    entity_id=str(expense.id),
    details=f"Updated expense {expense.id}",
    old_values=before,
    new_values={
      "vendor_id": expense.vendor_id,
      "category_id": expense.category_id,
      "description": expense.description,
      "date": str(expense.date),
      "amount": float(expense.amount),
      "tax_amount": float(expense.tax_amount),
      "status": expense.status.value,
    },
  )

  db.commit()
  db.refresh(expense)
  return expense


@router.post("/{expense_id}/approve", response_model=ExpenseRead)
def approve_expense(
  expense_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  expense = (
    db.query(Expense)
    .filter(Expense.tenant_id == tenant_id, Expense.id == expense_id, Expense.is_deleted.is_(False))
    .first()
  )
  if not expense:
    raise HTTPException(status_code=404, detail="Expense not found")

  expense.status = ExpenseStatus.approved
  expense.approved_by_user_id = ctx["user"].id
  db.add(expense)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="approve_expense",
    entity_type="Expense",
    entity_id=str(expense.id),
    details=f"Approved expense {expense.id}",
  )

  db.commit()
  db.refresh(expense)
  return expense


@router.post("/{expense_id}/reject", response_model=ExpenseRead)
def reject_expense(
  expense_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  expense = (
    db.query(Expense)
    .filter(Expense.tenant_id == tenant_id, Expense.id == expense_id, Expense.is_deleted.is_(False))
    .first()
  )
  if not expense:
    raise HTTPException(status_code=404, detail="Expense not found")

  expense.status = ExpenseStatus.rejected
  db.add(expense)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="reject_expense",
    entity_type="Expense",
    entity_id=str(expense.id),
    details=f"Rejected expense {expense.id}",
  )

  db.commit()
  db.refresh(expense)
  return expense


@router.post("/{expense_id}/receipts", status_code=status.HTTP_201_CREATED)
async def upload_receipt(
  expense_id: int,
  file: UploadFile = File(...),
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  expense = (
    db.query(Expense)
    .filter(Expense.tenant_id == tenant_id, Expense.id == expense_id, Expense.is_deleted.is_(False))
    .first()
  )
  if not expense:
    raise HTTPException(status_code=404, detail="Expense not found")

  # For now, we simulate storage and just keep a path reference
  contents = await file.read()
  # In production, write contents to S3/disk and set file_path accordingly
  fake_path = f"/tmp/tenant_{tenant_id}_expense_{expense_id}_{file.filename}"
  with open(fake_path, "wb") as f:
    f.write(contents)

  receipt = ExpenseReceipt(
    expense_id=expense.id,
    tenant_id=tenant_id,
    file_name=file.filename,
    content_type=file.content_type or "application/octet-stream",
    file_path=fake_path,
  )
  db.add(receipt)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="upload_expense_receipt",
    entity_type="Expense",
    entity_id=str(expense.id),
    details=f"Uploaded receipt {file.filename}",
  )

  db.commit()
  return {"ok": True}


# ----- Receipt upload (standalone) and create expense from receipt -----

def _receipt_upload_dir(tenant_id: int) -> str:
  base_dir = os.environ.get("RECEIPT_UPLOAD_DIR", "/tmp/sma_receipts")
  path = os.path.join(base_dir, str(tenant_id))
  os.makedirs(path, exist_ok=True)
  return path


@router.get("/receipts", response_model=list[ReceiptUploadRead])
def list_receipt_uploads(
  unattached_only: bool = False,
  expense_id: int | None = None,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  q = db.query(ReceiptUpload).filter(ReceiptUpload.tenant_id == tenant_id)
  if unattached_only:
    q = q.filter(ReceiptUpload.expense_id.is_(None))
  if expense_id is not None:
    q = q.filter(ReceiptUpload.expense_id == expense_id)
  rows = q.order_by(ReceiptUpload.uploaded_at.desc()).all()
  return [
    ReceiptUploadRead(
      id=r.id,
      tenant_id=r.tenant_id,
      expense_id=r.expense_id,
      file_name=r.file_name,
      content_type=r.content_type,
      extracted_data=r.extracted_data,
      uploaded_at=r.uploaded_at,
    )
    for r in rows
  ]


def _allowed_content_type(content_type: str | None) -> bool:
  if not content_type:
    return False
  allowed = [t.strip().lower() for t in settings.ALLOWED_UPLOAD_CONTENT_TYPES.split(",") if t.strip()]
  # Allow e.g. "image/jpeg" to match "image/jpeg" or "image/jpeg; charset=utf-8"
  base = content_type.split(";")[0].strip().lower()
  return base in allowed or any(base == t for t in allowed)


@router.post("/receipts/upload", response_model=ReceiptUploadRead, status_code=status.HTTP_201_CREATED)
async def upload_receipt_standalone(
  file: UploadFile = File(...),
  extract: bool = False,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  contents = await file.read()
  if not contents:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
  if len(contents) > settings.RECEIPT_MAX_BYTES:
    raise HTTPException(
      status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
      detail=f"File too large. Maximum size is {settings.RECEIPT_MAX_BYTES // (1024 * 1024)} MB",
    )
  if not _allowed_content_type(file.content_type):
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="File type not allowed. Allowed: images and PDF.",
    )

  upload_dir = _receipt_upload_dir(tenant_id)
  import uuid
  safe_name = "".join(c for c in (file.filename or "receipt") if c.isalnum() or c in "._- ")[:200]
  unique = str(uuid.uuid4())[:8]
  file_path = os.path.join(upload_dir, f"{unique}_{safe_name}")
  with open(file_path, "wb") as f:
    f.write(contents)

  extracted_data = None
  if extract:
    extracted_data = extract_receipt_data(contents, file.filename or "", file.content_type or "")

  rec = ReceiptUpload(
    tenant_id=tenant_id,
    expense_id=None,
    file_name=file.filename or "receipt",
    content_type=file.content_type or "application/octet-stream",
    file_path=file_path,
    extracted_data=extracted_data,
  )
  db.add(rec)
  db.commit()
  db.refresh(rec)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="upload_receipt",
    entity_type="ReceiptUpload",
    entity_id=str(rec.id),
    details=f"Uploaded receipt {rec.file_name}",
  )
  return ReceiptUploadRead(
    id=rec.id,
    tenant_id=rec.tenant_id,
    expense_id=rec.expense_id,
    file_name=rec.file_name,
    content_type=rec.content_type,
    extracted_data=rec.extracted_data,
    uploaded_at=rec.uploaded_at,
  )


@router.post("/receipts/{receipt_id}/extract", response_model=ReceiptUploadRead)
async def extract_receipt(
  receipt_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  rec = (
    db.query(ReceiptUpload)
    .filter(ReceiptUpload.id == receipt_id, ReceiptUpload.tenant_id == tenant_id)
    .first()
  )
  if not rec:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
  try:
    with open(rec.file_path, "rb") as f:
      contents = f.read()
  except OSError:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt file not found")
  rec.extracted_data = extract_receipt_data(contents, rec.file_name, rec.content_type)
  db.add(rec)
  db.commit()
  db.refresh(rec)
  return ReceiptUploadRead(
    id=rec.id,
    tenant_id=rec.tenant_id,
    expense_id=rec.expense_id,
    file_name=rec.file_name,
    content_type=rec.content_type,
    extracted_data=rec.extracted_data,
    uploaded_at=rec.uploaded_at,
  )


@router.get("/receipts/{receipt_id}/file")
def get_receipt_file(
  receipt_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  from fastapi.responses import FileResponse
  tenant_id = _get_tenant_id_or_400()
  rec = (
    db.query(ReceiptUpload)
    .filter(ReceiptUpload.id == receipt_id, ReceiptUpload.tenant_id == tenant_id)
    .first()
  )
  if not rec:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
  if not os.path.isfile(rec.file_path):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
  return FileResponse(
    rec.file_path,
    media_type=rec.content_type,
    filename=rec.file_name,
  )


@router.post("/from-receipt", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense_from_receipt(
  payload: CreateExpenseFromReceiptRequest,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  rec = (
    db.query(ReceiptUpload)
    .filter(ReceiptUpload.id == payload.receipt_id, ReceiptUpload.tenant_id == tenant_id)
    .first()
  )
  if not rec:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
  if rec.expense_id is not None:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Receipt already linked to an expense")

  ext = rec.extracted_data or {}
  description = (payload.description or ext.get("merchant") or rec.file_name or "Expense from receipt")
  if not isinstance(description, str):
    description = str(description)
  amount = float(payload.amount) if payload.amount is not None else float(ext.get("amount") or 0)
  if amount <= 0:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount is required (set in request or extract from receipt)")
  expense_date = payload.date
  if not expense_date and ext.get("date"):
    from datetime import date as date_type
    d = ext["date"]
    if isinstance(d, str):
      try:
        expense_date = date_type.fromisoformat(d[:10])
      except ValueError:
        expense_date = date_type.today()
    else:
      expense_date = date_type.today()
  if not expense_date:
    from datetime import date as date_type
    expense_date = date_type.today()
  currency = (payload.currency or ext.get("currency") or "ZAR").strip()[:3]
  tax_amount = float(payload.tax_amount) if payload.tax_amount is not None else 0

  if payload.vendor_id:
    vendor = (
      db.query(Vendor)
      .filter(Vendor.tenant_id == tenant_id, Vendor.id == payload.vendor_id, Vendor.is_active.is_(True))
      .first()
    )
    if not vendor:
      raise HTTPException(status_code=400, detail="Vendor not found")
  if payload.category_id:
    cat = (
      db.query(ExpenseCategory)
      .filter(ExpenseCategory.tenant_id == tenant_id, ExpenseCategory.id == payload.category_id)
      .first()
    )
    if not cat:
      raise HTTPException(status_code=400, detail="Category not found")

  expense = Expense(
    tenant_id=tenant_id,
    vendor_id=payload.vendor_id,
    category_id=payload.category_id,
    description=description[:255],
    date=expense_date,
    amount=amount,
    tax_amount=tax_amount,
    currency=currency,
    status=ExpenseStatus.submitted,
    created_by_user_id=ctx["user"].id,
  )
  db.add(expense)
  db.flush()
  rec.expense_id = expense.id
  db.add(rec)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="create_expense_from_receipt",
    entity_type="Expense",
    entity_id=str(expense.id),
    details=f"Created expense {expense.id} from receipt {rec.id}",
  )
  db.commit()
  db.refresh(expense)
  return expense


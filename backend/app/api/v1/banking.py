from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.accounting import BankAccount, BankTransaction, Invoice, Expense
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.expenses_banking import (
  BankAccountCreate,
  BankAccountRead,
  BankTransactionCreate,
  BankTransactionRead,
)
from app.utils.audit import log_audit

router = APIRouter(tags=["banking"])


def _get_tenant_id_or_400() -> int:
  tenant_id = get_current_tenant_id()
  if not tenant_id:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tenant_id


@router.get("/accounts", response_model=list[BankAccountRead])
def list_bank_accounts(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  accounts = db.query(BankAccount).filter(BankAccount.tenant_id == tenant_id).all()
  return accounts


@router.post("/accounts", response_model=BankAccountRead, status_code=status.HTTP_201_CREATED)
def create_bank_account(
  payload: BankAccountCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  account = BankAccount(
    tenant_id=tenant_id,
    name=payload.name,
    bank_name=payload.bank_name,
    iban=payload.iban,
    currency=payload.currency,
    opening_balance=payload.opening_balance,
  )
  db.add(account)
  db.commit()
  db.refresh(account)
  return account


@router.get("/transactions", response_model=list[BankTransactionRead])
def list_transactions(
  bank_account_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant", "viewer"])),
):
  tenant_id = _get_tenant_id_or_400()
  txs = (
    db.query(BankTransaction)
    .filter(
      BankTransaction.tenant_id == tenant_id,
      BankTransaction.bank_account_id == bank_account_id,
    )
    .order_by(BankTransaction.date, BankTransaction.id)
    .all()
  )
  return txs


@router.post("/transactions", response_model=BankTransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
  payload: BankTransactionCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()

  account = (
    db.query(BankAccount)
    .filter(BankAccount.tenant_id == tenant_id, BankAccount.id == payload.bank_account_id)
    .first()
  )
  if not account:
    raise HTTPException(status_code=400, detail="Bank account not found")

  last_balance = (
    db.query(BankTransaction.balance_after)
    .filter(
      BankTransaction.tenant_id == tenant_id,
      BankTransaction.bank_account_id == payload.bank_account_id,
    )
    .order_by(BankTransaction.date.desc(), BankTransaction.id.desc())
    .first()
  )
  starting_balance = last_balance[0] if last_balance else account.opening_balance
  new_balance = float(starting_balance) + float(payload.amount)

  tx = BankTransaction(
    tenant_id=tenant_id,
    bank_account_id=payload.bank_account_id,
    date=payload.date,
    description=payload.description,
    amount=payload.amount,
    balance_after=new_balance,
  )
  db.add(tx)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="create_bank_transaction",
    entity_type="BankTransaction",
    entity_id=str(tx.id),
    details=f"Created bank transaction {payload.description}",
  )

  db.commit()
  db.refresh(tx)
  return tx


@router.post("/transactions/{transaction_id}/match")
def match_transaction(
  transaction_id: int,
  invoice_id: int | None = None,
  expense_id: int | None = None,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  tenant_id = _get_tenant_id_or_400()
  tx = (
    db.query(BankTransaction)
    .filter(BankTransaction.tenant_id == tenant_id, BankTransaction.id == transaction_id)
    .first()
  )
  if not tx:
    raise HTTPException(status_code=404, detail="Transaction not found")

  if invoice_id:
    invoice = (
      db.query(Invoice)
      .filter(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
      .first()
    )
    if not invoice:
      raise HTTPException(status_code=400, detail="Invoice not found")
    tx.matched_invoice_id = invoice.id
  if expense_id:
    expense = (
      db.query(Expense)
      .filter(Expense.tenant_id == tenant_id, Expense.id == expense_id, Expense.is_deleted.is_(False))
      .first()
    )
    if not expense:
      raise HTTPException(status_code=400, detail="Expense not found")
    tx.matched_expense_id = expense.id

  tx.is_reconciled = True
  db.add(tx)

  log_audit(
    db,
    tenant_id=tenant_id,
    user_id=ctx["user"].id,
    action="match_bank_transaction",
    entity_type="BankTransaction",
    entity_id=str(tx.id),
    details=f"Matched transaction {tx.id}",
  )

  db.commit()
  return {"ok": True}


@router.get("/transactions/{transaction_id}/suggestions")
def match_suggestions(
  transaction_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "accountant"])),
):
  """
  Simple heuristic: suggest invoices/expenses with same amount (within small tolerance).
  """
  tenant_id = _get_tenant_id_or_400()
  tx = (
    db.query(BankTransaction)
    .filter(BankTransaction.tenant_id == tenant_id, BankTransaction.id == transaction_id)
    .first()
  )
  if not tx:
    raise HTTPException(status_code=404, detail="Transaction not found")

  amount = float(tx.amount)
  tolerance = 0.01

  candidate_invoices = (
    db.query(Invoice)
    .filter(
      Invoice.tenant_id == tenant_id,
      func.abs(Invoice.total - amount) <= tolerance,
    )
    .all()
  )

  candidate_expenses = (
    db.query(Expense)
    .filter(
      Expense.tenant_id == tenant_id,
      Expense.is_deleted.is_(False),
      func.abs(Expense.amount - amount) <= tolerance,
    )
    .all()
  )

  return {
    "invoices": [{"id": i.id, "invoice_number": i.invoice_number, "total": i.total} for i in candidate_invoices],
    "expenses": [{"id": e.id, "description": e.description, "amount": e.amount} for e in candidate_expenses],
  }


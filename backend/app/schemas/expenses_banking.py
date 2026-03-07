from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, condecimal, constr


class ExpenseCategoryBase(BaseModel):
  name: constr(strip_whitespace=True, max_length=100)
  tax_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None


class ExpenseCategoryCreate(ExpenseCategoryBase):
  pass


class ExpenseCategoryRead(ExpenseCategoryBase):
  id: int

  class Config:
    from_attributes = True


class VendorBase(BaseModel):
  name: constr(strip_whitespace=True, max_length=255)
  tax_number: Optional[constr(strip_whitespace=True, max_length=50)] = None
  email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  is_active: bool = True


class VendorCreate(VendorBase):
  pass


class VendorRead(VendorBase):
  id: int

  class Config:
    from_attributes = True


class ExpenseBase(BaseModel):
  vendor_id: Optional[int] = None
  category_id: Optional[int] = None
  description: constr(strip_whitespace=True, max_length=255)
  date: date
  amount: condecimal(max_digits=18, decimal_places=4)
  tax_amount: condecimal(max_digits=18, decimal_places=4) = 0
  currency: constr(strip_whitespace=True, max_length=3) = "ZAR"


class ExpenseCreate(ExpenseBase):
  pass


class ExpenseUpdate(BaseModel):
  vendor_id: Optional[int] = None
  category_id: Optional[int] = None
  description: Optional[constr(strip_whitespace=True, max_length=255)] = None
  date: Optional[date] = None
  amount: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  tax_amount: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  status: Optional[str] = None


class ExpenseRead(ExpenseBase):
  id: int
  status: str

  class Config:
    from_attributes = True


class ReceiptUploadRead(BaseModel):
  id: int
  tenant_id: int
  expense_id: Optional[int] = None
  file_name: str
  content_type: str
  extracted_data: Optional[dict] = None
  uploaded_at: datetime

  class Config:
    from_attributes = True


class CreateExpenseFromReceiptRequest(BaseModel):
  receipt_id: int
  vendor_id: Optional[int] = None
  category_id: Optional[int] = None
  description: Optional[constr(strip_whitespace=True, max_length=255)] = None
  date: Optional[date] = None
  amount: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  tax_amount: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = None  # ZAR or LSL


class BankAccountBase(BaseModel):
  name: constr(strip_whitespace=True, max_length=255)
  bank_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  iban: Optional[constr(strip_whitespace=True, max_length=50)] = None
  currency: constr(strip_whitespace=True, max_length=3) = "ZAR"
  opening_balance: condecimal(max_digits=18, decimal_places=4) = 0


class BankAccountCreate(BankAccountBase):
  pass


class BankAccountRead(BankAccountBase):
  id: int

  class Config:
    from_attributes = True


class BankTransactionBase(BaseModel):
  bank_account_id: int
  date: date
  description: constr(strip_whitespace=True, max_length=255)
  amount: condecimal(max_digits=18, decimal_places=4)


class BankTransactionCreate(BankTransactionBase):
  pass


class BankTransactionRead(BankTransactionBase):
  id: int
  balance_after: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  is_reconciled: bool
  matched_invoice_id: Optional[int] = None
  matched_expense_id: Optional[int] = None

  class Config:
    from_attributes = True


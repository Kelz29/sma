from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, condecimal, constr

CustomerType = Literal["individual", "company"]
DiscountType = Literal["percent", "amount"]


class CustomerBase(BaseModel):
  customer_type: CustomerType = "company"
  name: constr(strip_whitespace=True, max_length=255)
  email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  phone: Optional[constr(strip_whitespace=True, max_length=50)] = None
  address: Optional[str] = None
  contact_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  registration_number: Optional[constr(strip_whitespace=True, max_length=100)] = None
  vat_number: Optional[constr(strip_whitespace=True, max_length=50)] = None
  id_number: Optional[constr(strip_whitespace=True, max_length=50)] = None


class CustomerCreate(CustomerBase):
  pass


class CustomerRead(CustomerBase):
  id: int

  class Config:
    from_attributes = True


class CustomerUpdate(BaseModel):
  customer_type: Optional[CustomerType] = None
  name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  phone: Optional[constr(strip_whitespace=True, max_length=50)] = None
  address: Optional[str] = None
  contact_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  registration_number: Optional[constr(strip_whitespace=True, max_length=100)] = None
  vat_number: Optional[constr(strip_whitespace=True, max_length=50)] = None
  id_number: Optional[constr(strip_whitespace=True, max_length=50)] = None


class AccountBase(BaseModel):
  code: constr(strip_whitespace=True, max_length=50)
  name: constr(strip_whitespace=True, max_length=255)
  category: str
  parent_id: Optional[int] = Field(default=None)
  opening_debit: condecimal(max_digits=18, decimal_places=4) = 0
  opening_credit: condecimal(max_digits=18, decimal_places=4) = 0
  is_active: bool = True


class AccountCreate(AccountBase):
  pass


class AccountUpdate(BaseModel):
  name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  category: Optional[str] = None
  parent_id: Optional[int] = Field(default=None)
  opening_debit: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  opening_credit: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  is_active: Optional[bool] = None
  is_deleted: Optional[bool] = None


class AccountRead(AccountBase):
  id: int
  is_deleted: bool

  class Config:
    from_attributes = True


class InvoiceLineBase(BaseModel):
  description: constr(strip_whitespace=True, max_length=255)
  quantity: condecimal(max_digits=18, decimal_places=4) = 1
  unit_price: condecimal(max_digits=18, decimal_places=4)
  vat_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None


class InvoiceLineCreate(InvoiceLineBase):
  pass


class InvoiceLineRead(InvoiceLineBase):
  id: int
  line_total: condecimal(max_digits=18, decimal_places=4)

  class Config:
    from_attributes = True


class LineItemTemplateCreate(BaseModel):
  description: constr(strip_whitespace=True, max_length=255)
  default_quantity: condecimal(max_digits=18, decimal_places=4) = 1
  unit_price: condecimal(max_digits=18, decimal_places=4) = 0
  vat_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None


class LineItemTemplateUpdate(BaseModel):
  description: Optional[constr(strip_whitespace=True, max_length=255)] = None
  default_quantity: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  unit_price: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  vat_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None


class LineItemTemplateRead(BaseModel):
  id: int
  description: str
  default_quantity: condecimal(max_digits=18, decimal_places=4)
  unit_price: condecimal(max_digits=18, decimal_places=4)
  vat_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None

  class Config:
    from_attributes = True


class InvoiceBase(BaseModel):
  customer_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  customer_email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  issue_date: date
  due_date: Optional[date] = None
  currency: constr(strip_whitespace=True, max_length=3) = "ZAR"
  vat_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None
  vat_country: Optional[constr(strip_whitespace=True, max_length=2)] = None
  notes: Optional[str] = None
  is_recurring: bool = False
  recurring_interval_days: Optional[int] = None


class InvoiceCreate(BaseModel):
  """Either customer_id (use saved customer) or customer_name + optional customer_email (ad-hoc). Optional invoice_number lets the user choose the display number."""
  customer_id: Optional[int] = None
  customer_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  customer_email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  invoice_number: Optional[int] = None  # If set, use this; otherwise auto-increment per tenant
  issue_date: date
  due_date: Optional[date] = None
  currency: constr(strip_whitespace=True, max_length=3) = "ZAR"
  vat_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None
  vat_country: Optional[constr(strip_whitespace=True, max_length=2)] = None
  notes: Optional[str] = None
  is_recurring: bool = False
  recurring_interval_days: Optional[int] = None
  # percent | amount — discount applied to subtotal before VAT
  discount_type: Optional[Literal["percent", "amount"]] = None
  discount_value: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  lines: List[InvoiceLineCreate]


class InvoiceUpdate(BaseModel):
  customer_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  customer_email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  issue_date: Optional[date] = None
  due_date: Optional[date] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = None
  vat_rate: Optional[condecimal(max_digits=5, decimal_places=2)] = None
  vat_country: Optional[constr(strip_whitespace=True, max_length=2)] = None
  notes: Optional[str] = None
  status: Optional[str] = None
  is_recurring: Optional[bool] = None
  recurring_interval_days: Optional[int] = None
  discount_type: Optional[Literal["percent", "amount"]] = None
  discount_value: Optional[condecimal(max_digits=18, decimal_places=4)] = None
  clear_discount: bool = False
  lines: Optional[List[InvoiceLineCreate]] = None


class InvoicePaymentCreate(BaseModel):
  amount: condecimal(max_digits=18, decimal_places=4)
  payment_date: date
  method: Optional[constr(strip_whitespace=True, max_length=50)] = None
  reference: Optional[constr(strip_whitespace=True, max_length=255)] = None
  notes: Optional[str] = None
  bank_transaction_id: Optional[int] = None


class InvoicePaymentRead(BaseModel):
  id: int
  invoice_id: int
  amount: condecimal(max_digits=18, decimal_places=4)
  payment_date: date
  method: Optional[str] = None
  reference: Optional[str] = None
  notes: Optional[str] = None
  bank_transaction_id: Optional[int] = None
  created_at: datetime

  class Config:
    from_attributes = True


class InvoiceRead(InvoiceBase):
  id: int
  uuid: Optional[str] = None
  invoice_number: int
  customer_id: Optional[int] = None
  subtotal: condecimal(max_digits=18, decimal_places=4)
  discount_type: Optional[str] = None
  discount_percent: Optional[condecimal(max_digits=5, decimal_places=2)] = None
  discount_amount: condecimal(max_digits=18, decimal_places=4) = Decimal("0")
  vat_amount: condecimal(max_digits=18, decimal_places=4)
  total: condecimal(max_digits=18, decimal_places=4)
  amount_paid: condecimal(max_digits=18, decimal_places=4) = Decimal("0")
  balance_due: condecimal(max_digits=18, decimal_places=4) = Decimal("0")
  status: str
  lines: List[InvoiceLineRead]
  payments: List[InvoicePaymentRead] = []

  class Config:
    from_attributes = True


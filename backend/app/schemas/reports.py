from datetime import date
from typing import Optional, Literal

from pydantic import BaseModel


class SummaryPoint(BaseModel):
  period: str  # e.g. 2025-03, 2025-Q1, 2025
  revenue: float
  expenses: float
  profit: float


class SummaryReport(BaseModel):
  date_from: Optional[date] = None
  date_to: Optional[date] = None
  interval: Literal["day", "month", "quarter", "year"] = "month"
  currency: str = "ZAR"

  total_revenue: float
  total_expenses: float
  total_profit: float
  outstanding_invoices_total: float
  outstanding_invoices_count: int
  average_invoice_value: float

  series: list[SummaryPoint]


class SalesByCustomerRow(BaseModel):
  customer_name: str
  revenue: float
  invoice_count: int


class AgingBucket(BaseModel):
  label: str
  days_min: int
  days_max: Optional[int]
  total: float
  count: int


class AgingReport(BaseModel):
  as_of: date
  currency: str = "ZAR"
  buckets: list[AgingBucket]


class ReportEmailRequest(BaseModel):
  report_type: str  # summary, sales_by_customer, aging, invoices, expenses
  to_email: str
  date_from: Optional[date] = None
  date_to: Optional[date] = None
  as_of: Optional[date] = None
  format: Literal["csv"] = "csv"


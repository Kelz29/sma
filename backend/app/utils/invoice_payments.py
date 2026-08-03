"""Invoice payment helpers: amounts paid / balance and status sync."""
from decimal import Decimal

from app.db.models.accounting import Invoice, InvoiceStatus


def invoice_amount_paid(invoice: Invoice) -> Decimal:
  return sum((Decimal(str(p.amount or 0)) for p in (invoice.payments or [])), Decimal("0"))


def invoice_balance_due(invoice: Invoice) -> Decimal:
  total = Decimal(str(invoice.total or 0))
  paid = invoice_amount_paid(invoice)
  bal = total - paid
  return bal if bal > 0 else Decimal("0")


def sync_invoice_status_from_payments(invoice: Invoice) -> None:
  """Set paid / partially_paid from recorded payments. Leaves cancelled alone."""
  if invoice.status == InvoiceStatus.cancelled:
    return
  total = Decimal(str(invoice.total or 0))
  paid = invoice_amount_paid(invoice)
  if paid <= 0:
    if invoice.status in (InvoiceStatus.paid, InvoiceStatus.partially_paid):
      invoice.status = InvoiceStatus.sent
    return
  if paid + Decimal("0.01") >= total:
    invoice.status = InvoiceStatus.paid
  else:
    invoice.status = InvoiceStatus.partially_paid

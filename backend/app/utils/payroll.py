"""
South African PAYE and UIF calculations (simplified).
PAYE: 2025/2026 tax year brackets and rebates; monthly from annual equivalent.
UIF: 1% employee + 1% employer on gross, capped at remuneration ceiling.
"""
from decimal import Decimal
from typing import Literal

# 2025/2026 tax year (SARS-style). Bracket upper bounds annual (ZAR).
PAYE_BRACKETS_ANNUAL = [
  (237_100, Decimal("0.18")),
  (370_500, Decimal("0.26")),
  (512_800, Decimal("0.31")),
  (673_000, Decimal("0.36")),
  (857_900, Decimal("0.39")),
  (1_817_000, Decimal("0.41")),
  (None, Decimal("0.45")),  # above 1_817_000
]

# Annual rebates (ZAR). Under 65, 65-74, 75+
PAYE_REBATES_ANNUAL = (Decimal("17235"), Decimal("26679"), Decimal("29824"))

# Primary threshold: no tax if annual below this (under 65).
PAYE_THRESHOLD_UNDER_65 = Decimal("95750")

# UIF: 1% each side; ceiling on monthly remuneration (ZAR). Max UIF = ceiling * 0.01 per side.
UIF_RATE = Decimal("0.01")
UIF_CEILING_MONTHLY = Decimal("17712")


def annual_tax(annual_income: Decimal, age_group: Literal["under65", "65-74", "75+"] = "under65") -> Decimal:
  """Compute annual tax from annual taxable income (ZAR)."""
  if annual_income <= 0:
    return Decimal("0")
  if age_group == "under65" and annual_income <= PAYE_THRESHOLD_UNDER_65:
    return Decimal("0")

  tax = Decimal("0")
  remaining = annual_income
  prev_upper = Decimal("0")

  for upper, rate in PAYE_BRACKETS_ANNUAL:
    if remaining <= 0:
      break
    bracket_size = (Decimal(upper) - prev_upper) if upper is not None else remaining
    slice_ = min(remaining, bracket_size)
    tax += slice_ * rate
    remaining -= slice_
    if upper is not None:
      prev_upper = Decimal(upper)

  idx = {"under65": 0, "65-74": 1, "75+": 2}[age_group]
  rebate = PAYE_REBATES_ANNUAL[idx]
  tax = max(Decimal("0"), tax - rebate)
  return tax


def monthly_paye(gross_monthly: Decimal, age_group: Literal["under65", "65-74", "75+"] = "under65") -> Decimal:
  """Monthly PAYE from monthly gross (annualised as 12 * gross for bracket calc)."""
  annual = gross_monthly * 12
  return (annual_tax(annual, age_group) / 12).quantize(Decimal("0.01"))


def uif_employee(gross_monthly: Decimal) -> Decimal:
  """UIF employee contribution: 1% of gross, capped at UIF_CEILING_MONTHLY."""
  base = min(gross_monthly, UIF_CEILING_MONTHLY)
  return (base * UIF_RATE).quantize(Decimal("0.01"))


def uif_employer(gross_monthly: Decimal) -> Decimal:
  """UIF employer contribution: 1% of gross, capped at UIF_CEILING_MONTHLY."""
  return uif_employee(gross_monthly)


def net_after_paye_uif(
  gross_monthly: Decimal,
  age_group: Literal["under65", "65-74", "75+"] = "under65",
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
  """Returns (paye, uif_emp, uif_emplr, net)."""
  paye = monthly_paye(gross_monthly, age_group)
  uif_emp = uif_employee(gross_monthly)
  uif_emplr = uif_employer(gross_monthly)
  net = gross_monthly - paye - uif_emp
  return (paye, uif_emp, uif_emplr, net)

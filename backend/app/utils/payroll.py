"""
South African PAYE and UIF calculations.
PAYE: tax-year brackets and rebates (SARS); monthly from annual equivalent.
UIF: 1% employee + 1% employer on remuneration, capped at remuneration ceiling.
UIF applies only to contributing employees (for example, not exempt employees and
not employees working 24 hours or less in a month).
"""
from datetime import date
from decimal import Decimal
from typing import Any, Literal

# Tax year keyed by start year (1 March). Rebates are cumulative (primary / +secondary / +tertiary).
_PAYE_TABLES: dict[int, dict[str, Any]] = {
  # 2025/2026 (1 Mar 2025 – 28 Feb 2026)
  2025: {
    "brackets": [
      (237_100, Decimal("0.18")),
      (370_500, Decimal("0.26")),
      (512_800, Decimal("0.31")),
      (673_000, Decimal("0.36")),
      (857_900, Decimal("0.39")),
      (1_817_000, Decimal("0.41")),
      (None, Decimal("0.45")),
    ],
    "rebates": (Decimal("17235"), Decimal("26679"), Decimal("29824")),
    "threshold_under65": Decimal("95750"),
  },
  # 2026/2027 (1 Mar 2026 – 28 Feb 2027) — Budget 2026 inflation adjustment
  2026: {
    "brackets": [
      (245_100, Decimal("0.18")),
      (383_100, Decimal("0.26")),
      (530_200, Decimal("0.31")),
      (695_800, Decimal("0.36")),
      (887_000, Decimal("0.39")),
      (1_878_600, Decimal("0.41")),
      (None, Decimal("0.45")),
    ],
    "rebates": (Decimal("17820"), Decimal("27585"), Decimal("30834")),
    "threshold_under65": Decimal("99000"),
  },
}

# Default / current published tables (module-level aliases for callers and tests).
_LATEST_TAX_YEAR_START = max(_PAYE_TABLES)
PAYE_BRACKETS_ANNUAL = _PAYE_TABLES[_LATEST_TAX_YEAR_START]["brackets"]
PAYE_REBATES_ANNUAL = _PAYE_TABLES[_LATEST_TAX_YEAR_START]["rebates"]
PAYE_THRESHOLD_UNDER_65 = _PAYE_TABLES[_LATEST_TAX_YEAR_START]["threshold_under65"]

# UIF: 1% each side; ceiling on monthly remuneration (ZAR). Max UIF = ceiling * 0.01 per side.
UIF_RATE = Decimal("0.01")
UIF_CEILING_MONTHLY = Decimal("17712")
UIF_MIN_HOURS_PER_MONTH = Decimal("24")


def sa_tax_year_start(on: date) -> date:
  """South African tax year starts 1 March."""
  if on.month >= 3:
    return date(on.year, 3, 1)
  return date(on.year - 1, 3, 1)


def _paye_table_for(on: date | None = None) -> dict[str, Any]:
  """Resolve PAYE brackets/rebates for the SA tax year containing ``on`` (default: today)."""
  d = on or date.today()
  start_year = sa_tax_year_start(d).year
  if start_year in _PAYE_TABLES:
    return _PAYE_TABLES[start_year]
  # Before known tables → earliest; after → latest published
  if start_year < min(_PAYE_TABLES):
    return _PAYE_TABLES[min(_PAYE_TABLES)]
  return _PAYE_TABLES[max(_PAYE_TABLES)]


def annual_tax(
  annual_income: Decimal,
  age_group: Literal["under65", "65-74", "75+"] = "under65",
  *,
  for_date: date | None = None,
) -> Decimal:
  """Compute annual tax from annual taxable income (ZAR) for the tax year of ``for_date``."""
  table = _paye_table_for(for_date)
  brackets = table["brackets"]
  rebates = table["rebates"]
  threshold = table["threshold_under65"]

  if annual_income <= 0:
    return Decimal("0")
  if age_group == "under65" and annual_income <= threshold:
    return Decimal("0")

  tax = Decimal("0")
  remaining = annual_income
  prev_upper = Decimal("0")

  for upper, rate in brackets:
    if remaining <= 0:
      break
    bracket_size = (Decimal(upper) - prev_upper) if upper is not None else remaining
    slice_ = min(remaining, bracket_size)
    tax += slice_ * rate
    remaining -= slice_
    if upper is not None:
      prev_upper = Decimal(upper)

  idx = {"under65": 0, "65-74": 1, "75+": 2}[age_group]
  rebate = rebates[idx]
  tax = max(Decimal("0"), tax - rebate)
  return tax


def monthly_paye(
  gross_monthly: Decimal,
  age_group: Literal["under65", "65-74", "75+"] = "under65",
  *,
  for_date: date | None = None,
) -> Decimal:
  """Monthly PAYE from monthly gross (annualised as 12 * gross for bracket calc)."""
  annual = gross_monthly * 12
  return (annual_tax(annual, age_group, for_date=for_date) / 12).quantize(Decimal("0.01"))


def is_uif_applicable(
  *,
  hours_worked_per_month: Decimal | None = None,
  uif_exempt: bool = False,
) -> bool:
  """Whether UIF contributions should be calculated for this employee."""
  if uif_exempt:
    return False
  if hours_worked_per_month is not None and hours_worked_per_month <= UIF_MIN_HOURS_PER_MONTH:
    return False
  return True


def uif_employee(
  gross_monthly: Decimal,
  *,
  hours_worked_per_month: Decimal | None = None,
  uif_exempt: bool = False,
) -> Decimal:
  """UIF employee contribution: 1% of remuneration, capped at UIF_CEILING_MONTHLY."""
  if not is_uif_applicable(hours_worked_per_month=hours_worked_per_month, uif_exempt=uif_exempt):
    return Decimal("0.00")
  base = min(gross_monthly, UIF_CEILING_MONTHLY)
  return (base * UIF_RATE).quantize(Decimal("0.01"))


def uif_employer(
  gross_monthly: Decimal,
  *,
  hours_worked_per_month: Decimal | None = None,
  uif_exempt: bool = False,
) -> Decimal:
  """UIF employer contribution: 1% of remuneration, capped at UIF_CEILING_MONTHLY."""
  return uif_employee(
    gross_monthly,
    hours_worked_per_month=hours_worked_per_month,
    uif_exempt=uif_exempt,
  )


def net_after_paye_uif(
  gross_monthly: Decimal,
  age_group: Literal["under65", "65-74", "75+"] = "under65",
  *,
  hours_worked_per_month: Decimal | None = None,
  uif_exempt: bool = False,
  for_date: date | None = None,
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
  """Returns (paye, uif_emp, uif_emplr, net). PAYE uses tables for ``for_date``'s tax year."""
  paye = monthly_paye(gross_monthly, age_group, for_date=for_date)
  uif_emp = uif_employee(
    gross_monthly,
    hours_worked_per_month=hours_worked_per_month,
    uif_exempt=uif_exempt,
  )
  uif_emplr = uif_employer(
    gross_monthly,
    hours_worked_per_month=hours_worked_per_month,
    uif_exempt=uif_exempt,
  )
  net = gross_monthly - paye - uif_emp
  return (paye, uif_emp, uif_emplr, net)


def sum_payslip_ytd(
  slips: list,
  *,
  through_period_start: date,
) -> tuple[Decimal, Decimal]:
  """
  Sum YTD tax (PAYE) and total earnings (gross) for the SA tax year
  containing ``through_period_start``, including that period.
  ``slips`` items must have period_start, paye, and gross attributes.
  """
  year_start = sa_tax_year_start(through_period_start)
  ytd_tax = Decimal("0")
  ytd_earnings = Decimal("0")
  for s in slips:
    if s.period_start < year_start or s.period_start > through_period_start:
      continue
    ytd_tax += Decimal(str(s.paye or 0))
    ytd_earnings += Decimal(str(s.gross or 0))
  return (ytd_tax.quantize(Decimal("0.01")), ytd_earnings.quantize(Decimal("0.01")))

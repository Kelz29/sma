"""Build HTML for payslip PDF."""
from datetime import date
from decimal import Decimal


def _fmt_date(d: date | None) -> str:
  if d is None:
    return ""
  return str(d)


def _fmt_num(n: Decimal | float | None) -> str:
  if n is None:
    return "0.00"
  return f"{float(n):,.2f}"


def build_payslip_html(
  *,
  company_name: str = "Company",
  employee_name: str,
  employee_number: str,
  period_start: date,
  period_end: date,
  gross: Decimal,
  paye: Decimal,
  uif_employee: Decimal,
  uif_employer: Decimal,
  net: Decimal,
  currency: str = "ZAR",
  line_items: list[dict] | None = None,
  company_address: str | None = None,
) -> str:
  lines = line_items or []
  address = (company_address or "").strip()
  return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      color: #0f172a;
      background: #e5e7eb;
    }}
    .page {{
      max-width: 840px;
      margin: 0 auto;
    }}
    .card {{
      background: #ffffff;
      border-radius: 6px;
      padding: 24px 32px 28px 32px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
      border: 1px solid rgba(148, 163, 184, 0.5);
    }}
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }}
    .company-name {{
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #0f172a;
    }}
    .company-meta {{
      margin-top: 4px;
      font-size: 11px;
      color: #6b7280;
      white-space: pre-line;
    }}
    .payslip-badge {{
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border-radius: 4px;
      border: 1px solid #0f766e;
      background: #ecfdf5;
      color: #065f46;
    }}
    .period {{
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 12px;
    }}
    .summary-bar {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      border-radius: 4px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      margin-bottom: 18px;
    }}
    .summary-left {{
      font-size: 11px;
      color: #0369a1;
    }}
    .summary-net-label {{
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f766e;
      margin-bottom: 2px;
    }}
    .summary-net-amount {{
      font-size: 18px;
      font-weight: 700;
      color: #064e3b;
    }}
    .employee-panel {{
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 12px 14px;
      border-radius: 4px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      margin-bottom: 18px;
    }}
    .employee-name {{
      font-weight: 600;
      font-size: 13px;
      color: #111827;
    }}
    .employee-meta-row {{
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }}
    .label-sm {{
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9ca3af;
      margin-bottom: 2px;
    }}
    .value-sm {{
      font-size: 11px;
      color: #111827;
    }}
    .columns {{
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1.3fr);
      gap: 24px;
      margin-top: 8px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th {{
      text-align: left;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 11px;
      color: #6b7280;
    }}
    td {{
      padding: 6px 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: 12px;
    }}
    .amount {{
      text-align: right;
    }}
    .row-label-muted {{
      color: #4b5563;
    }}
    .row-negative {{
      color: #b91c1c;
    }}
    .net-row td {{
      padding-top: 10px;
      border-top: 1px dashed #d1d5db;
      font-weight: 600;
      color: #065f46;
    }}
    .totals-card {{
      border-radius: 4px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      padding: 10px 12px;
      font-size: 11px;
    }}
    .totals-row {{
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }}
    .totals-row-label {{
      color: #6b7280;
    }}
    .totals-row-amount {{
      font-weight: 600;
      color: #111827;
    }}
    .totals-row-amount.negative {{
      color: #b91c1c;
    }}
    .footer {{
      margin-top: 18px;
      font-size: 10px;
      color: #9ca3af;
    }}
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div>
          <div class="company-name">{company_name}</div>
          {f'<div class="company-meta">{address}</div>' if address else ''}
        </div>
        <div class="payslip-badge">Payslip</div>
      </div>

      <div class="period">
        Period: {_fmt_date(period_start)} to {_fmt_date(period_end)}
      </div>

      <div class="summary-bar">
        <div class="summary-left">
          <div>Employee: <strong>{employee_name}</strong></div>
          <div>Employee no: {employee_number}</div>
        </div>
        <div style="text-align: right;">
          <div class="summary-net-label">Net pay ({currency})</div>
          <div class="summary-net-amount">{_fmt_num(net)}</div>
        </div>
      </div>

      <div class="employee-panel">
        <div>
          <div class="employee-name">{employee_name}</div>
          <div class="employee-meta-row">Employee no: {employee_number}</div>
        </div>
        <div>
          <div class="label-sm">Pay period</div>
          <div class="value-sm">{_fmt_date(period_start)} – {_fmt_date(period_end)}</div>
        </div>
        <div>
          <div class="label-sm">Currency</div>
          <div class="value-sm">{currency}</div>
        </div>
      </div>

      <div class="columns">
        <div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="amount">Amount ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="row-label-muted">Gross pay</td>
                <td class="amount">{_fmt_num(gross)}</td>
              </tr>
              <tr>
                <td class="row-label-muted">PAYE</td>
                <td class="amount row-negative">({_fmt_num(paye)})</td>
              </tr>
              <tr>
                <td class="row-label-muted">UIF (employee)</td>
                <td class="amount row-negative">({_fmt_num(uif_employee)})</td>
              </tr>
              {"".join(
                f'<tr><td class="row-label-muted">{li.get("label", "Item")}</td><td class="amount">{_fmt_num(li.get("amount"))}</td></tr>'
                for li in lines
              )}
              <tr class="net-row">
                <td>Net pay</td>
                <td class="amount">{_fmt_num(net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div class="totals-card">
            <div class="totals-row">
              <span class="totals-row-label">Gross earnings</span>
              <span class="totals-row-amount">{_fmt_num(gross)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-row-label">Total deductions</span>
              <span class="totals-row-amount negative">({_fmt_num(paye + uif_employee)})</span>
            </div>
            <div class="totals-row" style="margin-top: 6px; border-top: 1px dashed #d1d5db; padding-top: 6px;">
              <span class="totals-row-label">Net pay</span>
              <span class="totals-row-amount">{_fmt_num(net)}</span>
            </div>
            <div class="totals-row" style="margin-top: 8px;">
              <span class="totals-row-label">UIF (employer)</span>
              <span class="totals-row-amount">{_fmt_num(uif_employer)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        UIF employer contribution (1%): {_fmt_num(uif_employer)} {currency}. This is a computer-generated payslip and does not require a signature.
      </div>
    </div>
  </div>
</body>
</html>
"""

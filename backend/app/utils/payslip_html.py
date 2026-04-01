"""Build HTML for payslip PDF with selectable themes."""
import html as html_module
import os
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Literal

from app.core.config import settings

PayslipTheme = Literal["classic", "modern", "minimal"]
_VALID_THEMES = frozenset({"classic", "modern", "minimal"})


def _fmt_date(d: date | None) -> str:
  if d is None:
    return ""
  return str(d)


def _fmt_num(n: Decimal | float | None) -> str:
  if n is None:
    return "0.00"
  return f"{float(n):,.2f}"


def _normalize_theme(theme: str) -> PayslipTheme:
  t = (theme or "classic").strip().lower()
  if t in _VALID_THEMES:
    return t  # type: ignore[return-value]
  return "classic"


def _logo_src_for_pdf(logo_url: str | None) -> str | None:
  """Resolve tenant logo for WeasyPrint: remote URLs as-is; local /uploads/... → file URI."""
  if not logo_url:
    return None
  u = str(logo_url).strip()
  if not u:
    return None
  if u.startswith(("http://", "https://", "data:")):
    return u
  path_part = u[1:] if u.startswith("/") else u
  if path_part.startswith("uploads/"):
    path_part = path_part[len("uploads/") :]
  upload_root = Path(settings.UPLOAD_DIR)
  if not upload_root.is_absolute():
    upload_root = Path(os.getcwd()) / upload_root
  upload_root = upload_root.resolve()
  candidate = (upload_root / path_part).resolve()
  try:
    candidate.relative_to(upload_root)
  except ValueError:
    return None
  if candidate.is_file():
    return candidate.as_uri()
  alt = Path(os.getcwd()) / u.lstrip("/")
  if alt.is_file():
    return alt.resolve().as_uri()
  return None


def _a4_print_base() -> str:
  """WeasyPrint: A4 portrait, printable margins, full-width content area."""
  return """
    @page {
      size: A4 portrait;
      margin: 11mm 13mm;
    }
    html, body {
      margin: 0;
      padding: 0;
    }
    * {
      box-sizing: border-box;
    }
    .ps-page {
      width: 100%;
      max-width: 100%;
      margin: 0;
    }
  """


def _styles_classic() -> str:
  return """
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 10.5pt; line-height: 1.35; color: #0f172a; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ps-card { background: #ffffff; border-radius: 4px; padding: 5mm 6mm 6mm 6mm; border: 1px solid rgba(148, 163, 184, 0.6); page-break-inside: avoid; break-inside: avoid; }
    .ps-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 3mm; margin-bottom: 3mm; }
    .ps-header-brand { display: flex; align-items: flex-start; gap: 3mm; min-width: 0; }
    .ps-header-text { min-width: 0; }
    .ps-logo-wrap { flex-shrink: 0; }
    .ps-logo { max-height: 11mm; max-width: 42mm; width: auto; height: auto; display: block; object-fit: contain; }
    .ps-company-name { font-size: 13pt; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #0f172a; line-height: 1.2; }
    .ps-company-meta { margin-top: 1mm; font-size: 8.5pt; color: #6b7280; white-space: pre-line; }
    .ps-badge { padding: 1mm 2mm; font-size: 8pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 2px; border: 1px solid #0f766e; background: #ecfdf5; color: #065f46; flex-shrink: 0; }
    .ps-period { font-size: 8.5pt; color: #6b7280; margin-bottom: 2.5mm; }
    .ps-summary-bar { display: flex; justify-content: space-between; gap: 3mm; padding: 2.5mm 3mm; border-radius: 3px; background: #f9fafb; border: 1px solid #e5e7eb; margin-bottom: 3mm; }
    .ps-summary-left { font-size: 8.5pt; color: #0369a1; }
    .ps-net-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #0f766e; margin-bottom: 0.5mm; }
    .ps-net-amount { font-size: 14pt; font-weight: 700; color: #064e3b; text-align: right; line-height: 1.1; }
    .ps-employee-panel { display: flex; justify-content: space-between; gap: 4mm; padding: 2.5mm 3mm; border-radius: 3px; background: #f9fafb; border: 1px solid #e5e7eb; margin-bottom: 3mm; }
    .ps-employee-name { font-weight: 600; font-size: 10pt; color: #111827; }
    .ps-employee-meta { font-size: 8.5pt; color: #6b7280; margin-top: 0.5mm; }
    .ps-label-sm { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 0.5mm; }
    .ps-value-sm { font-size: 8.5pt; color: #111827; }
    .ps-columns { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(0, 1.15fr); gap: 4mm; margin-top: 1mm; align-items: start; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 1.5mm 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 8pt; color: #6b7280; }
    td { padding: 1.2mm 0; border-bottom: 1px solid #f3f4f6; font-size: 9.5pt; }
    .ps-amount { text-align: right; font-variant-numeric: tabular-nums; }
    .ps-row-muted { color: #4b5563; }
    .ps-row-neg { color: #b91c1c; }
    .ps-net-row td { padding-top: 2mm; border-top: 1px dashed #d1d5db; font-weight: 600; color: #065f46; }
    .ps-totals-card { border-radius: 3px; border: 1px solid #e5e7eb; background: #f9fafb; padding: 2.5mm 3mm; font-size: 8.5pt; }
    .ps-totals-row { display: flex; justify-content: space-between; margin-bottom: 1mm; }
    .ps-totals-label { color: #6b7280; }
    .ps-totals-val { font-weight: 600; color: #111827; font-variant-numeric: tabular-nums; }
    .ps-totals-val.neg { color: #b91c1c; }
    .ps-totals-divider { margin-top: 2mm; border-top: 1px dashed #cbd5e1; padding-top: 2mm; }
    .ps-totals-uif { margin-top: 2.5mm; }
    .ps-footer { margin-top: 3mm; font-size: 8pt; color: #9ca3af; }
    .ps-footer-main { line-height: 1.4; }
    .ps-powered { margin-top: 2mm; font-size: 6.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: #9ca3af; }
  """


def _styles_modern() -> str:
  return """
    body { font-family: "Segoe UI", system-ui, sans-serif; font-size: 10.5pt; line-height: 1.35; color: #111827; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ps-card { background: #ffffff; border-radius: 3mm; overflow: hidden; border: 1px solid #e2e8f0; page-break-inside: avoid; break-inside: avoid; }
    .ps-banner { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0f766e 100%); color: #fff; padding: 4mm 5mm 4.5mm 5mm; }
    .ps-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 3mm; margin-bottom: 0; }
    .ps-header-brand { display: flex; align-items: center; gap: 3mm; min-width: 0; }
    .ps-header-text { min-width: 0; }
    .ps-banner .ps-logo-wrap { background: rgba(255,255,255,0.14); padding: 1.5mm 2.5mm; border-radius: 2mm; border: 1px solid rgba(255,255,255,0.22); flex-shrink: 0; }
    .ps-banner .ps-logo { max-height: 10mm; max-width: 38mm; width: auto; height: auto; display: block; object-fit: contain; }
    .ps-company-name { font-size: 14pt; font-weight: 700; letter-spacing: -0.02em; color: #ffffff; text-transform: none; line-height: 1.15; }
    .ps-company-meta { margin-top: 1.5mm; font-size: 8.5pt; color: rgba(255,255,255,0.88); white-space: pre-line; line-height: 1.35; }
    .ps-badge { padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 4mm; border: 1px solid rgba(255,255,255,0.35); background: rgba(255,255,255,0.12); color: #c8f135; flex-shrink: 0; }
    .ps-inner { padding: 4mm 5mm 5mm 5mm; }
    .ps-period { font-size: 8.5pt; color: #64748b; margin-bottom: 2.5mm; font-weight: 500; }
    .ps-summary-bar { display: flex; justify-content: space-between; gap: 3mm; padding: 2.5mm 3mm; border-radius: 2mm; background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; margin-bottom: 3mm; }
    .ps-summary-left { font-size: 8.5pt; color: #334155; }
    .ps-net-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #0f766e; margin-bottom: 1mm; }
    .ps-net-amount { font-size: 15pt; font-weight: 800; color: #047857; letter-spacing: -0.02em; text-align: right; line-height: 1.1; }
    .ps-employee-panel { display: flex; justify-content: space-between; gap: 3mm; padding: 2.5mm 3mm; border-radius: 2mm; background: #fff; border: 1px solid #e2e8f0; margin-bottom: 3mm; }
    .ps-employee-name { font-weight: 700; font-size: 10.5pt; color: #0f172a; }
    .ps-employee-meta { font-size: 8.5pt; color: #64748b; margin-top: 0.5mm; }
    .ps-label-sm { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 0.5mm; }
    .ps-value-sm { font-size: 8.5pt; color: #1e293b; font-weight: 500; }
    .ps-columns { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(0, 1.15fr); gap: 4mm; margin-top: 1mm; align-items: start; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 1.5mm 0; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    td { padding: 1.2mm 0; border-bottom: 1px solid #f1f5f9; font-size: 9.5pt; }
    .ps-amount { text-align: right; font-variant-numeric: tabular-nums; }
    .ps-row-muted { color: #475569; }
    .ps-row-neg { color: #dc2626; }
    .ps-net-row td { padding-top: 2mm; border-top: 1px solid #0f766e; border-bottom: none; font-weight: 800; font-size: 10.5pt; color: #047857; }
    .ps-totals-card { border-radius: 2mm; border: 1px solid #e2e8f0; background: #f8fafc; padding: 2.5mm 3mm; font-size: 8.5pt; }
    .ps-totals-row { display: flex; justify-content: space-between; margin-bottom: 1mm; }
    .ps-totals-label { color: #64748b; }
    .ps-totals-val { font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
    .ps-totals-val.neg { color: #dc2626; }
    .ps-totals-divider { margin-top: 2mm; border-top: 1px dashed #cbd5e1; padding-top: 2mm; }
    .ps-totals-uif { margin-top: 2.5mm; }
    .ps-footer { margin-top: 3mm; font-size: 8pt; color: #94a3b8; line-height: 1.4; }
    .ps-footer-main { line-height: 1.4; }
    .ps-powered { margin-top: 2mm; font-size: 6.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8; }
  """


def _styles_minimal() -> str:
  return """
    body { margin: 0; padding: 0; font-family: Georgia, "Times New Roman", serif; font-size: 10pt; line-height: 1.35; color: #1a1a1a; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ps-page { width: 100%; max-width: 100%; margin: 0; }
    .ps-card { background: #ffffff; border: 1px solid #1a1a1a; padding: 7mm 8mm 8mm 8mm; page-break-inside: avoid; break-inside: avoid; }
    .ps-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5pt solid #1a1a1a; padding-bottom: 8pt; margin-bottom: 10pt; }
    .ps-header-brand { display: flex; align-items: flex-start; gap: 10pt; min-width: 0; }
    .ps-header-text { min-width: 0; }
    .ps-logo-wrap { flex-shrink: 0; }
    .ps-logo { max-height: 11mm; max-width: 40mm; width: auto; height: auto; display: block; object-fit: contain; }
    .ps-company-name { font-size: 12pt; font-weight: 700; letter-spacing: 0.02em; color: #1a1a1a; text-transform: uppercase; font-family: Georgia, serif; line-height: 1.15; }
    .ps-company-meta { margin-top: 4pt; font-size: 8.5pt; color: #444; white-space: pre-line; font-family: system-ui, sans-serif; }
    .ps-badge { font-size: 8pt; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #1a1a1a; border: 1px solid #1a1a1a; padding: 4pt 7pt; font-family: system-ui, sans-serif; flex-shrink: 0; }
    .ps-period { font-size: 8.5pt; color: #555; margin-bottom: 8pt; font-family: system-ui, sans-serif; }
    .ps-summary-bar { display: flex; justify-content: space-between; gap: 12pt; padding: 0 0 8pt 0; border-bottom: 1px solid #ccc; margin-bottom: 10pt; page-break-inside: avoid; }
    .ps-summary-left { font-size: 8.5pt; color: #333; font-family: system-ui, sans-serif; }
    .ps-net-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 2pt; font-family: system-ui, sans-serif; }
    .ps-net-amount { font-size: 15pt; font-weight: 700; color: #1a1a1a; text-align: right; font-family: Georgia, serif; line-height: 1.1; }
    .ps-employee-panel { display: flex; justify-content: space-between; gap: 12pt; padding: 8pt 0; border-bottom: 1px solid #e5e5e5; margin-bottom: 10pt; font-family: system-ui, sans-serif; page-break-inside: avoid; }
    .ps-employee-name { font-weight: 600; font-size: 10pt; color: #1a1a1a; }
    .ps-employee-meta { font-size: 8.5pt; color: #666; margin-top: 2pt; }
    .ps-label-sm { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 2pt; }
    .ps-value-sm { font-size: 8.5pt; color: #222; }
    .ps-columns { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 5mm; margin-top: 4pt; align-items: start; }
    table { width: 100%; border-collapse: collapse; font-family: system-ui, sans-serif; }
    th { text-align: left; padding: 4pt 0; border-bottom: 1px solid #1a1a1a; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #1a1a1a; }
    td { padding: 3pt 0; border-bottom: 1px solid #e8e8e8; font-size: 9.5pt; }
    .ps-amount { text-align: right; font-variant-numeric: tabular-nums; }
    .ps-row-muted { color: #444; }
    .ps-row-neg { color: #8b0000; }
    .ps-net-row td { padding-top: 6pt; border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a; font-weight: 700; font-size: 10pt; color: #1a1a1a; }
    .ps-totals-card { border: 1px solid #ccc; padding: 7pt 8pt; font-size: 8.5pt; font-family: system-ui, sans-serif; background: #fafafa; page-break-inside: avoid; }
    .ps-totals-row { display: flex; justify-content: space-between; margin-bottom: 3pt; gap: 8pt; }
    .ps-totals-label { color: #555; }
    .ps-totals-val { font-weight: 600; color: #1a1a1a; font-variant-numeric: tabular-nums; }
    .ps-totals-val.neg { color: #8b0000; }
    .ps-totals-divider { margin-top: 2mm; border-top: 1px dashed #ccc; padding-top: 2mm; }
    .ps-totals-uif { margin-top: 2.5mm; }
    .ps-footer { margin-top: 2.5mm; font-size: 8pt; color: #777; font-family: system-ui, sans-serif; border-top: 1px solid #e5e5e5; padding-top: 2.5mm; }
    .ps-footer-main { line-height: 1.4; }
    .ps-powered { margin-top: 6pt; font-size: 6.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: #999; }
  """


def _theme_styles(theme: PayslipTheme) -> str:
  base = _a4_print_base()
  if theme == "modern":
    return base + _styles_modern()
  if theme == "minimal":
    return base + _styles_minimal()
  return base + _styles_classic()


def _payslip_body(
  *,
  company_name: str,
  company_registration_number: str | None,
  employee_name: str,
  employee_number: str,
  period_start: date,
  period_end: date,
  gross: Decimal,
  paye: Decimal,
  uif_employee: Decimal,
  uif_employer: Decimal,
  net: Decimal,
  currency: str,
  lines: list[dict],
  address: str,
  theme: PayslipTheme,
  company_logo_url: str | None,
) -> str:
  company_meta_parts = []
  if address:
    company_meta_parts.append(address)
  reg_no = (company_registration_number or "").strip()
  if reg_no:
    company_meta_parts.append(f"Registration no: {reg_no}")
  company_meta = "\n".join(company_meta_parts)
  addr_html = f'<div class="ps-company-meta">{company_meta}</div>' if company_meta else ""
  logo_src = _logo_src_for_pdf(company_logo_url)
  logo_html = ""
  if logo_src:
    safe_src = html_module.escape(logo_src, quote=True)
    logo_html = f'<div class="ps-logo-wrap"><img class="ps-logo" src="{safe_src}" alt="" /></div>'
  extra_rows = "".join(
    f'<tr><td class="ps-row-muted">{li.get("label", "Item")}</td><td class="ps-amount">{_fmt_num(li.get("amount"))}</td></tr>'
    for li in lines
  )

  inner_block = f"""
      <div class="ps-header">
        <div class="ps-header-brand">
          {logo_html}
          <div class="ps-header-text">
            <div class="ps-company-name">{company_name}</div>
            {addr_html}
          </div>
        </div>
        <div class="ps-badge">Payslip</div>
      </div>
  """

  if theme == "modern":
    card_open = '<div class="ps-card"><div class="ps-banner">'
    card_mid = '</div><div class="ps-inner">'
    card_close = "</div></div>"
    header_section = f"{card_open}{inner_block}{card_mid}"
  else:
    card_open = '<div class="ps-card">'
    card_mid = ""
    card_close = "</div>"
    header_section = f"{card_open}{inner_block}{card_mid}"

  return f"""
  <div class="ps-page">
    {header_section}
      <div class="ps-period">
        Period: {_fmt_date(period_start)} to {_fmt_date(period_end)}
      </div>

      <div class="ps-summary-bar">
        <div class="ps-summary-left">
          <div>Employee: <strong>{employee_name}</strong></div>
          <div>Employee no: {employee_number}</div>
        </div>
        <div>
          <div class="ps-net-label">Net pay ({currency})</div>
          <div class="ps-net-amount">{_fmt_num(net)}</div>
        </div>
      </div>

      <div class="ps-employee-panel">
        <div>
          <div class="ps-employee-name">{employee_name}</div>
          <div class="ps-employee-meta">Employee no: {employee_number}</div>
        </div>
        <div>
          <div class="ps-label-sm">Pay period</div>
          <div class="ps-value-sm">{_fmt_date(period_start)} – {_fmt_date(period_end)}</div>
        </div>
        <div>
          <div class="ps-label-sm">Currency</div>
          <div class="ps-value-sm">{currency}</div>
        </div>
      </div>

      <div class="ps-columns">
        <div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="ps-amount">Amount ({currency})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="ps-row-muted">Gross pay</td>
                <td class="ps-amount">{_fmt_num(gross)}</td>
              </tr>
              <tr>
                <td class="ps-row-muted">PAYE</td>
                <td class="ps-amount ps-row-neg">({_fmt_num(paye)})</td>
              </tr>
              <tr>
                <td class="ps-row-muted">UIF (employee)</td>
                <td class="ps-amount ps-row-neg">({_fmt_num(uif_employee)})</td>
              </tr>
              {extra_rows}
              <tr class="ps-net-row">
                <td>Net pay</td>
                <td class="ps-amount">{_fmt_num(net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div class="ps-totals-card">
            <div class="ps-totals-row">
              <span class="ps-totals-label">Gross earnings</span>
              <span class="ps-totals-val">{_fmt_num(gross)}</span>
            </div>
            <div class="ps-totals-row">
              <span class="ps-totals-label">Total deductions</span>
              <span class="ps-totals-val neg">({_fmt_num(paye + uif_employee)})</span>
            </div>
            <div class="ps-totals-row ps-totals-divider">
              <span class="ps-totals-label">Net pay</span>
              <span class="ps-totals-val">{_fmt_num(net)}</span>
            </div>
            <div class="ps-totals-row ps-totals-uif">
              <span class="ps-totals-label">UIF (employer)</span>
              <span class="ps-totals-val">{_fmt_num(uif_employer)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="ps-footer">
        <div class="ps-footer-main">UIF employer contribution (1%): {_fmt_num(uif_employer)} {currency}.</div>
        <div class="ps-powered">Powered by SmartSeen</div>
      </div>
    {card_close}
  </div>
  """


def build_payslip_html(
  *,
  company_name: str = "Company",
  company_registration_number: str | None = None,
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
  company_logo_url: str | None = None,
  theme: str = "classic",
) -> str:
  """Render payslip HTML. ``theme``: classic | modern | minimal."""
  th = _normalize_theme(theme)
  lines = line_items or []
  address = (company_address or "").strip()
  css = _theme_styles(th)
  body = _payslip_body(
    company_name=company_name,
    company_registration_number=company_registration_number,
    employee_name=employee_name,
    employee_number=employee_number,
    period_start=period_start,
    period_end=period_end,
    gross=gross,
    paye=paye,
    uif_employee=uif_employee,
    uif_employer=uif_employer,
    net=net,
    currency=currency,
    lines=lines,
    address=address,
    theme=th,
    company_logo_url=company_logo_url,
  )
  return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>{css}</style>
</head>
<body>
{body}
</body>
</html>
"""

"""
Build HTML for invoice/quotation PDF with selectable themes.
Includes company logo, address, notes, and footer.
"""
from datetime import date
from typing import Literal

Theme = Literal["classic", "modern", "minimal", "elegant", "bold", "professional"]
Doctype = Literal["invoice", "quotation"]

# Placeholder logo (small SVG data URI) when no company logo provided
PLACEHOLDER_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40' viewBox='0 0 120 40'%3E%3Crect width='120' height='40' fill='%23059669' rx='6'/%3E%3Ctext x='60' y='26' font-family='system-ui' font-size='14' font-weight='bold' fill='white' text-anchor='middle'%3EYour Logo%3C/text%3E%3C/svg%3E"


def _fmt_date(d: date | None) -> str:
  if d is None:
    return ""
  return str(d)


def _fmt_num(n: float | None) -> str:
  if n is None:
    return "0.00"
  return f"{float(n):,.2f}"


def _line_density(lines: list[dict] | None) -> dict:
  """Scale the whole document down when an invoice has many line items.

  Everything (body text, line table, totals) shifts together so a dense
  invoice still reads as one coherent document rather than a shrunken table.
  """
  n = len(lines or [])
  # Long descriptions also need room — bump density if average description is long.
  avg_len = 0
  if n:
    avg_len = sum(len(str(l.get("description") or "")) for l in lines) / n
  if n >= 18 or (n >= 12 and avg_len >= 60):
    return {
      "level": "dense",
      "body_font": "11px",
      "font": "10.5px",
      "pad": "4px 6px",
      "th_pad": "6px 6px",
      "totals_font": "11px",
      "totals_grand": "14px",
      "page_margin": "11mm 12mm",
    }
  if n >= 10:
    return {
      "level": "compact",
      "body_font": "12.5px",
      "font": "11.5px",
      "pad": "5px 7px",
      "th_pad": "7px 7px",
      "totals_font": "12px",
      "totals_grand": "15px",
      "page_margin": "12mm 13mm",
    }
  return {
    "level": "normal",
    "body_font": "",
    "font": "13px",
    "pad": "8px 10px",
    "th_pad": "10px 8px",
    "totals_font": "",
    "totals_grand": "",
    "page_margin": "12mm 14mm",
  }


def _head_css(density: dict) -> str:
  """Shared print/PDF CSS: repeating table headers, wrapping descriptions, density scaling."""
  d = density
  compact = d["level"] != "normal"

  # For dense invoices scale the whole page down together and use the full
  # printable width, so the line table stays in proportion with everything else.
  scale_css = ""
  if compact:
    scale_css = f"""
  html, body {{
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
    font-size: {d['body_font']} !important;
  }}
  .inv-totals {{
    width: 300px !important;
    margin-left: auto !important;
    margin-right: 0 !important;
    padding: 10px 14px !important;
    font-size: {d['totals_font']} !important;
  }}
  .inv-totals p, .inv-totals div, .inv-totals td, .inv-totals span {{
    font-size: {d['totals_font']} !important;
  }}
  .inv-totals td {{ padding: 3px 6px !important; }}
  .inv-totals .grand, .inv-totals .grand span {{
    font-size: {d['totals_grand']} !important;
  }}
  .inv-totals .grand td {{
    font-size: {d['totals_grand']} !important;
    padding-top: 8px !important;
  }}
"""

  return f"""
<style>
  @page {{ size: A4; margin: {d['page_margin']}; }}
  *, *::before, *::after {{ box-sizing: border-box; }}
{scale_css}
  .inv-lines {{
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: {d['font']};
  }}
  .inv-lines thead {{ display: table-header-group; }}
  .inv-lines tr {{ page-break-inside: avoid; break-inside: avoid; }}
  .inv-lines th {{
    padding: {d['th_pad']} !important;
    font-size: {d['font']} !important;
    line-height: 1.25;
  }}
  .inv-lines td {{
    padding: {d['pad']} !important;
    font-size: {d['font']} !important;
    vertical-align: top;
    line-height: 1.35;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }}
  .inv-lines col.desc {{ width: auto; }}
  .inv-lines col.qty {{ width: 54px; }}
  .inv-lines col.price {{ width: 82px; }}
  .inv-lines col.amount {{ width: 88px; }}
  .inv-lines th:nth-child(2), .inv-lines td:nth-child(2),
  .inv-lines th:nth-child(3), .inv-lines td:nth-child(3),
  .inv-lines th:nth-child(4), .inv-lines td:nth-child(4) {{
    white-space: nowrap;
    text-align: right;
  }}
  .inv-totals {{ page-break-inside: avoid; break-inside: avoid; }}
</style>
"""


def _lines_colgroup(four_cols: bool = True) -> str:
  if four_cols:
    return '<colgroup><col class="desc"/><col class="qty"/><col class="price"/><col class="amount"/></colgroup>'
  return '<colgroup><col class="desc"/><col class="amount"/></colgroup>'


def _banking_section(
  bank_name: str | None,
  bank_account_number: str | None,
  bank_branch_code: str | None,
  primary_color: str | None = None,
  company_name: str | None = None,
  reference: int | None = None,
  compact: bool = False,
) -> str:
  parts = []
  if company_name and company_name.strip():
    parts.append(f"<div><strong>Name</strong> {company_name.strip()}</div>")
  if reference is not None:
    parts.append(f"<div><strong>Reference</strong> {reference}</div>")
  if bank_name:
    parts.append(f"<div><strong>Bank</strong> {bank_name}</div>")
  if bank_account_number:
    parts.append(f"<div><strong>Account number</strong> {bank_account_number}</div>")
  if bank_branch_code:
    parts.append(f"<div><strong>Branch code</strong> {bank_branch_code}</div>")
  if not parts:
    return ""
  border = f"border-left:4px solid {primary_color or '#059669'}"
  pad = "10px 12px" if compact else "16px"
  mt = "14px" if compact else "24px"
  fs = "12px" if compact else "14px"
  lh = "1.5" if compact else "1.8"
  return (
    f'<div style="margin-top:{mt};padding:{pad};background:#f8fafc;border-radius:8px;{border}">'
    f'<p style="margin:0 0 6px;font-size:11px;color:#475569;text-transform:uppercase;font-weight:600">Payment details</p>'
    f'<div style="font-size:{fs};line-height:{lh}">{chr(10).join(parts)}</div></div>'
  )


def _payment_summary_section(
  *,
  currency: str,
  total: float,
  amount_paid: float,
  balance_due: float,
  payments: list[dict] | None,
  primary_color: str | None = None,
  compact: bool = False,
) -> str:
  """Amount paid / balance due plus a list of recorded payments (invoices only)."""
  paid = float(amount_paid or 0)
  balance = float(balance_due if balance_due is not None else max(0.0, float(total or 0) - paid))
  payment_rows = payments or []
  accent = primary_color or "#059669"
  status_label = "Paid in full" if balance <= 0.01 and paid > 0 else ("Partially paid" if paid > 0 else "Unpaid")
  status_color = "#047857" if balance <= 0.01 and paid > 0 else ("#b45309" if paid > 0 else "#64748b")

  history = ""
  if payment_rows:
    rows = "".join(
      f"""<tr>
        <td style="padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:12px">{_fmt_date(p.get('payment_date'))}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">{(p.get('method') or '—')}{((' · ' + str(p['reference'])) if p.get('reference') else '')}</td>
        <td style="padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-weight:600">{currency} {_fmt_num(p.get('amount'))}</td>
      </tr>"""
      for p in payment_rows
    )
    history = f"""
    <p style="margin:10px 0 4px;font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.04em">Payments received</p>
    <table style="width:100%;border-collapse:collapse">{rows}</table>
    """

  pad = "10px 12px" if compact else "16px"
  mt = "12px" if compact else "20px"
  fs = "12px" if compact else "14px"
  return f"""
  <div style="margin-top:{mt};padding:{pad};background:#f8fafc;border-radius:8px;border-left:4px solid {accent}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <p style="margin:0;font-size:11px;color:#475569;text-transform:uppercase;font-weight:600">Payment status</p>
      <span style="font-size:11px;font-weight:600;color:{status_color}">{status_label}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:{fs}">
      <tr>
        <td style="padding:3px 0;color:#64748b">Amount paid</td>
        <td style="padding:3px 0;text-align:right;font-weight:600">{currency} {_fmt_num(paid)}</td>
      </tr>
      <tr>
        <td style="padding:3px 0;color:#64748b">Balance due</td>
        <td style="padding:3px 0;text-align:right;font-weight:700;font-size:14px">{currency} {_fmt_num(balance)}</td>
      </tr>
    </table>
    {history}
  </div>
  """


def _bill_to_extra_html(
  *,
  phone: str | None = None,
  address: str | None = None,
  contact_name: str | None = None,
  registration_number: str | None = None,
  vat_number: str | None = None,
  id_number: str | None = None,
  color: str = "#666666",
) -> str:
  parts: list[str] = []
  if contact_name and contact_name.strip():
    parts.append(f"Attn: {contact_name.strip()}")
  if phone and phone.strip():
    parts.append(phone.strip())
  if address and address.strip():
    parts.append(address.strip().replace("\n", "<br/>"))
  if registration_number and registration_number.strip():
    parts.append(f"Reg: {registration_number.strip()}")
  if vat_number and vat_number.strip():
    parts.append(f"VAT: {vat_number.strip()}")
  if id_number and id_number.strip():
    parts.append(f"ID: {id_number.strip()}")
  return "".join(
    f'<p style="margin:2px 0 0;color:{color};font-size:13px;line-height:1.35">{p}</p>' for p in parts
  )


def build_invoice_html(
  *,
  title: str,
  doc_number: int,
  customer_name: str,
  customer_email: str | None,
  issue_date: date,
  due_date: date | None,
  currency: str,
  subtotal: float,
  vat_amount: float,
  total: float,
  vat_rate: float | None,
  vat_country: str | None,
  notes: str | None,
  lines: list[dict],
  theme: Theme = "classic",
  doctype: Doctype = "invoice",
  company_name: str = "Your Company",
  company_logo_url: str | None = None,
  company_address: str | None = None,
  footer_text: str | None = None,
  bank_name: str | None = None,
  bank_account_number: str | None = None,
  bank_branch_code: str | None = None,
  primary_color: str | None = None,
  secondary_color: str | None = None,
  amount_paid: float = 0,
  balance_due: float | None = None,
  payments: list[dict] | None = None,
  discount_amount: float = 0,
  discount_percent: float | None = None,
  customer_phone: str | None = None,
  customer_billing_address: str | None = None,
  customer_contact_name: str | None = None,
  customer_registration_number: str | None = None,
  customer_vat_number: str | None = None,
  customer_id_number: str | None = None,
) -> str:
  doc_label = "Quotation" if doctype == "quotation" else "Invoice"
  logo_url = (company_logo_url or "").strip() or PLACEHOLDER_LOGO_SVG
  address = (company_address or "").strip()
  footer = (footer_text or "").strip() or "Thank you for your business. Payment is due within 30 days."
  density = _line_density(lines)
  compact = density["level"] != "normal"
  banking_html = _banking_section(
    bank_name, bank_account_number, bank_branch_code, primary_color,
    company_name=company_name, reference=doc_number, compact=compact,
  )
  prim = primary_color or "#333333"
  sec = secondary_color or "#059669"
  if doctype == "invoice":
    bal = balance_due if balance_due is not None else max(0.0, float(total or 0) - float(amount_paid or 0))
    payment_html = _payment_summary_section(
      currency=currency,
      total=float(total or 0),
      amount_paid=float(amount_paid or 0),
      balance_due=float(bal),
      payments=payments,
      primary_color=prim,
      compact=compact,
    )
  else:
    payment_html = ""
  bill_to_extra = _bill_to_extra_html(
    phone=customer_phone,
    address=customer_billing_address,
    contact_name=customer_contact_name,
    registration_number=customer_registration_number,
    vat_number=customer_vat_number,
    id_number=customer_id_number,
    color="#666666",
  )
  kwargs_common = dict(
    title=title, doc_label=doc_label, doc_number=doc_number,
    customer_name=customer_name, customer_email=customer_email,
    bill_to_extra=bill_to_extra,
    issue_date=issue_date, due_date=due_date, currency=currency,
    subtotal=subtotal, discount_amount=float(discount_amount or 0),
    discount_percent=discount_percent, vat_amount=vat_amount, total=total,
    vat_rate=vat_rate, vat_country=vat_country, notes=notes, lines=lines,
    company_name=company_name, logo_url=logo_url, company_address=address,
    footer_text=footer, banking_html=banking_html, payment_html=payment_html,
    primary_color=prim, secondary_color=sec,
    density=density,
  )
  if theme == "elegant":
    return _theme_elegant(**kwargs_common)
  if theme == "bold":
    return _theme_bold(**kwargs_common)
  if theme == "professional":
    return _theme_professional(**kwargs_common)
  if theme == "minimal":
    return _theme_minimal(**kwargs_common)
  if theme == "modern":
    return _theme_modern(**kwargs_common)
  return _theme_classic(**kwargs_common)


def _logo_img(logo_url: str, max_height_px: int = 48) -> str:
  return f'<img src="{logo_url}" alt="Logo" style="max-height:{max_height_px}px;width:auto;display:block"/>'


def _theme_classic(
  title: str,
  doc_label: str,
  doc_number: int,
  customer_name: str,
  customer_email: str | None,
  issue_date: date,
  due_date: date | None,
  currency: str,
  subtotal: float,
  vat_amount: float,
  total: float,
  vat_rate: float | None,
  vat_country: str | None,
  notes: str | None,
  lines: list[dict],
  company_name: str,
  logo_url: str,
  company_address: str,
  footer_text: str,
  banking_html: str = "",
  payment_html: str = "",
  bill_to_extra: str = "",
  discount_amount: float = 0,
  discount_percent: float | None = None,
  density: dict | None = None,
  primary_color: str = "#333333",
  secondary_color: str = "#059669",
) -> str:
  rows = "".join(
    f"""
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">{line.get('description', '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{_fmt_num(line.get('quantity'))}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{_fmt_num(line.get('unit_price'))}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">{_fmt_num(line.get('line_total'))}</td>
    </tr>"""
    for line in lines
  )
  return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{doc_label} #{doc_number}</title>{_head_css(density or _line_density(lines))}</head>
<body style="font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;color:#333">
  <table style="width:100%;border-bottom:2px solid {primary_color};padding-bottom:16px">
    <tr>
      <td style="vertical-align:top">{_logo_img(logo_url, 48)}</td>
      <td style="text-align:right;vertical-align:top">
        <h1 style="margin:0;font-size:24px">{company_name}</h1>
        {f'<p style="margin:6px 0 0;font-size:12px;color:#666;line-height:1.4">{company_address}</p>' if company_address else ''}
      </td>
    </tr>
  </table>
  <h2 style="margin-top:28px;border-bottom:1px solid {primary_color};padding-bottom:6px;font-size:18px">{doc_label} #{doc_number}</h2>
  <table style="width:100%;margin-top:20px">
    <tr>
      <td style="width:50%;vertical-align:top">
        <p style="margin:0;font-size:11px;color:#666;text-transform:uppercase">Bill to</p>
        <p style="margin:4px 0 0;font-weight:600">{customer_name}</p>
        {f'<p style="margin:2px 0 0;color:#666;font-size:13px">{customer_email}</p>' if customer_email else ''}{bill_to_extra}
      </td>
      <td style="text-align:right;vertical-align:top">
        <p style="margin:0"><strong>Issue date</strong> {_fmt_date(issue_date)}</p>
        <p style="margin:6px 0 0"><strong>Due date</strong> {_fmt_date(due_date)}</p>
      </td>
    </tr>
  </table>
  <table class="inv-lines" style="width:100%;margin-top:20px;border-collapse:collapse">
    {_lines_colgroup()}
    <thead><tr style="background:#f5f5f5">
      <th style="text-align:left">Description</th>
      <th style="text-align:right">Qty</th>
      <th style="text-align:right">Unit price</th>
      <th style="text-align:right">Amount</th>
    </tr></thead>
    <tbody>{rows}</tbody>
  </table>
  <table class="inv-totals" style="width:100%;margin-top:16px;border-collapse:collapse">
    <tr><td style="padding:8px;text-align:right">Subtotal</td><td style="text-align:right;width:120px">{currency} {_fmt_num(subtotal)}</td></tr>
    {f'<tr><td style="padding:8px;text-align:right">Discount{f" ({_fmt_num(discount_percent)}%)" if discount_percent else ""}</td><td style="text-align:right">-{currency} {_fmt_num(discount_amount)}</td></tr>' if discount_amount else ''}
    <tr><td style="padding:8px;text-align:right">VAT{f' ({_fmt_num(vat_rate)}%)' if vat_rate else ''}</td><td style="text-align:right">{currency} {_fmt_num(vat_amount)}</td></tr>
    <tr class="grand" style="font-weight:bold;font-size:1.1em"><td style="padding:12px 8px;text-align:right">Total</td><td style="text-align:right">{currency} {_fmt_num(total)}</td></tr>
  </table>
  {f'<div style="margin-top:24px;padding:12px;background:#f9f9f9;border-left:4px solid {primary_color}"><p style="margin:0;color:#555;font-size:13px"><strong>Notes</strong><br/>{notes}</p></div>' if notes else ''}
  {payment_html}
  {banking_html}
  <div style="margin-top:48px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#666;text-align:center;line-height:1.5">{footer_text}</div>
</body>
</html>
"""


def _theme_modern(
  title: str,
  doc_label: str,
  doc_number: int,
  customer_name: str,
  customer_email: str | None,
  issue_date: date,
  due_date: date | None,
  currency: str,
  subtotal: float,
  vat_amount: float,
  total: float,
  vat_rate: float | None,
  vat_country: str | None,
  notes: str | None,
  lines: list[dict],
  company_name: str,
  logo_url: str,
  company_address: str,
  footer_text: str,
  banking_html: str = "",
  payment_html: str = "",
  bill_to_extra: str = "",
  discount_amount: float = 0,
  discount_percent: float | None = None,
  density: dict | None = None,
  primary_color: str = "#059669",
  secondary_color: str = "#047857",
) -> str:
  rows = "".join(
    f"""
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">{line.get('description', '')}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right">{_fmt_num(line.get('quantity'))}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right">{_fmt_num(line.get('unit_price'))}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">{_fmt_num(line.get('line_total'))}</td>
    </tr>"""
    for line in lines
  )
  return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{doc_label} #{doc_number}</title>{_head_css(density or _line_density(lines))}</head>
<body style="font-family:'Segoe UI',system-ui,sans-serif;max-width:720px;margin:0 auto;padding:0;color:#111827;background:#fff">
  <div style="background:linear-gradient(135deg,{primary_color} 0%,{secondary_color} 100%);color:#fff;padding:28px 32px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="background:rgba(255,255,255,0.2);padding:8px;border-radius:8px">{_logo_img(logo_url, 44)}</div>
      <div>
        <div style="font-size:11px;opacity:0.9;text-transform:uppercase;letter-spacing:0.08em">{doc_label}</div>
        <h1 style="margin:4px 0 0;font-size:24px;font-weight:700">#{str(doc_number).zfill(5)}</h1>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:600">{company_name}</div>
      {f'<div style="font-size:11px;opacity:0.9;margin-top:4px">{company_address}</div>' if company_address else ''}
    </div>
  </div>
  <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:24px;margin-bottom:28px">
      <div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px">Bill to</div>
        <div style="font-weight:600;font-size:15px">{customer_name}</div>
        {f'<div style="color:#6b7280;font-size:13px">{customer_email}</div>' if customer_email else ''}{bill_to_extra}
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#6b7280">Issue date</div>
        <div style="font-weight:500">{_fmt_date(issue_date)}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:8px">Due date</div>
        <div style="font-weight:500">{_fmt_date(due_date)}</div>
      </div>
    </div>
    <table class="inv-lines" style="width:100%;border-collapse:collapse">
      {_lines_colgroup()}
      <thead><tr style="background:#f9fafb;color:#6b7280;text-transform:uppercase">
        <th style="text-align:left">Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit price</th>
        <th style="text-align:right">Amount</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <div class="inv-totals" style="margin-top:24px;text-align:right;background:#f9fafb;padding:20px 24px;border-radius:8px">
      <div style="margin-bottom:8px">Subtotal <span style="float:right;font-weight:500">{currency} {_fmt_num(subtotal)}</span></div>
      {f'<div style="margin-bottom:8px">Discount{f" ({_fmt_num(discount_percent)}%)" if discount_percent else ""} <span style="float:right;font-weight:500">-{currency} {_fmt_num(discount_amount)}</span></div>' if discount_amount else ''}
      <div style="margin-bottom:8px">VAT <span style="float:right;font-weight:500">{currency} {_fmt_num(vat_amount)}</span></div>
      <div class="grand" style="font-size:18px;font-weight:700;margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb">Total <span style="float:right">{currency} {_fmt_num(total)}</span></div>
    </div>
    {f'<div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid {primary_color}"><p style="margin:0;color:#166534;font-size:13px"><strong>Notes</strong><br/>{notes}</p></div>' if notes else ''}
    {payment_html}
    {banking_html}
    <div style="margin-top:36px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;text-align:center;line-height:1.6">{footer_text}</div>
  </div>
</body>
</html>
"""


def _theme_minimal(
  title: str,
  doc_label: str,
  doc_number: int,
  customer_name: str,
  customer_email: str | None,
  issue_date: date,
  due_date: date | None,
  currency: str,
  subtotal: float,
  vat_amount: float,
  total: float,
  vat_rate: float | None,
  vat_country: str | None,
  notes: str | None,
  lines: list[dict],
  company_name: str,
  logo_url: str,
  company_address: str,
  footer_text: str,
  banking_html: str = "",
  payment_html: str = "",
  bill_to_extra: str = "",
  discount_amount: float = 0,
  discount_percent: float | None = None,
  density: dict | None = None,
  primary_color: str = "#000000",
  secondary_color: str = "#333333",
) -> str:
  rows = "".join(
    f"<tr><td style='padding:10px 0;border-bottom:1px solid #eee'>{line.get('description', '')}</td><td style='text-align:right;padding:10px 0;border-bottom:1px solid #eee'>{_fmt_num(line.get('line_total'))}</td></tr>"
    for line in lines
  )
  return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{doc_label} #{doc_number}</title>{_head_css(density or _line_density(lines))}</head>
<body style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#000;font-size:14px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid {primary_color}">
    <div>{_logo_img(logo_url, 40)}</div>
    <div style="text-align:right">
      <div style="font-weight:700;font-size:16px">{company_name}</div>
      {f'<div style="font-size:11px;color:#666;margin-top:4px">{company_address}</div>' if company_address else ''}
    </div>
  </div>
  <p style="font-size:11px;color:#888;margin-bottom:24px">{doc_label} #{doc_number} · {_fmt_date(issue_date)}</p>
  <p style="font-weight:600;margin-bottom:2px">{customer_name}</p>
  {f'<p style="color:#666;margin-bottom:20px;font-size:13px">{customer_email}</p>' if customer_email else ''}{bill_to_extra}
  <table class="inv-lines" style="width:100%;margin:16px 0;border-collapse:collapse">
    {_lines_colgroup(False)}
    <tbody>{rows}</tbody>
  </table>
  <p class="inv-totals grand" style="text-align:right;margin-top:16px;font-size:18px;font-weight:600">Total {currency} {_fmt_num(total)}</p>
  {f'<p style="margin-top:28px;padding:12px;background:#f5f5f5;font-size:13px;color:#444">{notes}</p>' if notes else ''}
  {payment_html}
  {banking_html}
  <p style="margin-top:40px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#888;text-align:center;line-height:1.5">{footer_text}</p>
</body>
</html>
"""


def _theme_elegant(
  title: str,
  doc_label: str,
  doc_number: int,
  customer_name: str,
  customer_email: str | None,
  issue_date: date,
  due_date: date | None,
  currency: str,
  subtotal: float,
  vat_amount: float,
  total: float,
  vat_rate: float | None,
  vat_country: str | None,
  notes: str | None,
  lines: list[dict],
  company_name: str,
  logo_url: str,
  company_address: str,
  footer_text: str,
  banking_html: str = "",
  payment_html: str = "",
  bill_to_extra: str = "",
  discount_amount: float = 0,
  discount_percent: float | None = None,
  density: dict | None = None,
  primary_color: str = "#8a837c",
  secondary_color: str = "#5a534d",
) -> str:
  rows = "".join(
    f"""
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e4e0;font-size:14px">{line.get('description', '')}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e4e0;text-align:right">{_fmt_num(line.get('quantity'))}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e4e0;text-align:right">{_fmt_num(line.get('unit_price'))}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e8e4e0;text-align:right;font-weight:500">{_fmt_num(line.get('line_total'))}</td>
    </tr>"""
    for line in lines
  )
  return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{doc_label} #{doc_number}</title>{_head_css(density or _line_density(lines))}</head>
<body style="font-family:'Cormorant Garamond',Georgia,serif;max-width:680px;margin:0 auto;padding:48px 32px;color:#2c2825;background:#faf9f7">
  <div style="text-align:center;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid {primary_color}">
    {_logo_img(logo_url, 52)}
    <h1 style="margin:16px 0 4px;font-size:28px;font-weight:600;letter-spacing:0.02em">{company_name}</h1>
    {f'<p style="margin:0;font-size:13px;color:#6b6560;line-height:1.5">{company_address}</p>' if company_address else ''}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
    <div>
      <p style="margin:0;font-size:11px;color:{primary_color};text-transform:uppercase;letter-spacing:0.1em">Bill to</p>
      <p style="margin:6px 0 0;font-size:18px;font-weight:600">{customer_name}</p>
      {f'<p style="margin:4px 0 0;font-size:14px;color:#6b6560">{customer_email}</p>' if customer_email else ''}{bill_to_extra}
    </div>
    <div style="text-align:right">
      <p style="margin:0;font-size:14px"><strong>{doc_label}</strong> <span style="color:{primary_color}">#{str(doc_number).zfill(5)}</span></p>
      <p style="margin:12px 0 0;font-size:13px">Issue: {_fmt_date(issue_date)}</p>
      <p style="margin:4px 0 0;font-size:13px">Due: {_fmt_date(due_date)}</p>
    </div>
  </div>
  <table class="inv-lines" style="width:100%;border-collapse:collapse">
    {_lines_colgroup()}
    <thead><tr style="background:#f0ebe5;color:#5a534d;text-transform:uppercase;letter-spacing:0.08em">
      <th style="text-align:left">Description</th>
      <th style="text-align:right">Qty</th>
      <th style="text-align:right">Unit price</th>
      <th style="text-align:right">Amount</th>
    </tr></thead>
    <tbody>{rows}</tbody>
  </table>
  <div class="inv-totals" style="margin-top:28px;text-align:right;padding:20px 24px;background:#f5f1eb;border-radius:4px">
    <p style="margin:0 0 8px">Subtotal <span style="margin-left:16px;font-weight:500">{currency} {_fmt_num(subtotal)}</span></p>
    {f'<p style="margin:0 0 8px">Discount{f" ({_fmt_num(discount_percent)}%)" if discount_percent else ""} <span style="margin-left:16px;font-weight:500">-{currency} {_fmt_num(discount_amount)}</span></p>' if discount_amount else ''}
    <p style="margin:0 0 8px">VAT <span style="margin-left:16px;font-weight:500">{currency} {_fmt_num(vat_amount)}</span></p>
    <p class="grand" style="margin:12px 0 0;font-size:18px;font-weight:600">Total <span style="margin-left:16px">{currency} {_fmt_num(total)}</span></p>
  </div>
  {f'<div style="margin-top:28px;padding:18px;background:#faf9f7;border:1px solid #e8e4e0;border-radius:4px"><p style="margin:0;color:#5a534d;font-size:13px;line-height:1.6"><strong>Notes</strong><br/>{notes}</p></div>' if notes else ''}
  {payment_html}
  {banking_html}
  <p style="margin-top:48px;padding-top:24px;border-top:1px solid #e8e4e0;font-size:12px;color:#8a837c;text-align:center;line-height:1.6">{footer_text}</p>
</body>
</html>
"""


def _theme_bold(
  title: str,
  doc_label: str,
  doc_number: int,
  customer_name: str,
  customer_email: str | None,
  issue_date: date,
  due_date: date | None,
  currency: str,
  subtotal: float,
  vat_amount: float,
  total: float,
  vat_rate: float | None,
  vat_country: str | None,
  notes: str | None,
  lines: list[dict],
  company_name: str,
  logo_url: str,
  company_address: str,
  footer_text: str,
  banking_html: str = "",
  payment_html: str = "",
  bill_to_extra: str = "",
  discount_amount: float = 0,
  discount_percent: float | None = None,
  density: dict | None = None,
  primary_color: str = "#f59e0b",
  secondary_color: str = "#fbbf24",
) -> str:
  rows = "".join(
    f"""
    <tr>
      <td style="padding:14px 20px;border-bottom:1px solid #374151">{line.get('description', '')}</td>
      <td style="padding:14px 20px;border-bottom:1px solid #374151;text-align:right">{_fmt_num(line.get('quantity'))}</td>
      <td style="padding:14px 20px;border-bottom:1px solid #374151;text-align:right">{_fmt_num(line.get('unit_price'))}</td>
      <td style="padding:14px 20px;border-bottom:1px solid #374151;text-align:right;font-weight:600;color:{secondary_color}">{_fmt_num(line.get('line_total'))}</td>
    </tr>"""
    for line in lines
  )
  return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{doc_label} #{doc_number}</title>{_head_css(density or _line_density(lines))}</head>
<body style="font-family:system-ui,sans-serif;max-width:700px;margin:0 auto;padding:0;color:#f9fafb;background:#111827">
  <div style="background:#1f2937;padding:32px 40px;border-bottom:4px solid {primary_color}">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px">
      <div style="display:flex;align-items:center;gap:20px">
        <div style="background:#374151;padding:10px;border-radius:8px">{_logo_img(logo_url, 48)}</div>
        <div>
          <h1 style="margin:0;font-size:22px;font-weight:700">{company_name}</h1>
          {f'<p style="margin:6px 0 0;font-size:12px;color:#9ca3af">{company_address}</p>' if company_address else ''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">{doc_label}</div>
        <div style="font-size:28px;font-weight:800;color:{secondary_color}">#{str(doc_number).zfill(5)}</div>
      </div>
    </div>
  </div>
  <div style="padding:32px 40px">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:24px;margin-bottom:28px;padding:20px;background:#1f2937;border-radius:8px">
      <div>
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase">Bill to</p>
        <p style="margin:6px 0 0;font-weight:600;font-size:16px">{customer_name}</p>
        {f'<p style="margin:4px 0 0;color:#9ca3af;font-size:14px">{customer_email}</p>' if customer_email else ''}{bill_to_extra}
      </div>
      <div style="text-align:right;color:#d1d5db">
        <p style="margin:0">Issue: {_fmt_date(issue_date)}</p>
        <p style="margin:8px 0 0">Due: {_fmt_date(due_date)}</p>
      </div>
    </div>
    <table class="inv-lines" style="width:100%;border-collapse:collapse">
      {_lines_colgroup()}
      <thead><tr style="background:#374151;color:{secondary_color};text-transform:uppercase">
        <th style="text-align:left">Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit price</th>
        <th style="text-align:right">Amount</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <div class="inv-totals" style="margin-top:24px;text-align:right;padding:24px;background:#1f2937;border-radius:8px;border:1px solid #374151">
      <p style="margin:0 0 8px;color:#9ca3af">Subtotal <span style="float:right;font-weight:500;color:#fff">{currency} {_fmt_num(subtotal)}</span></p>
      {f'<p style="margin:0 0 8px;color:#9ca3af">Discount{f" ({_fmt_num(discount_percent)}%)" if discount_percent else ""} <span style="float:right;font-weight:500;color:#fff">-{currency} {_fmt_num(discount_amount)}</span></p>' if discount_amount else ''}
      <p style="margin:0 0 8px;color:#9ca3af">VAT <span style="float:right;font-weight:500;color:#fff">{currency} {_fmt_num(vat_amount)}</span></p>
      <p class="grand" style="margin:16px 0 0;font-size:20px;font-weight:700;color:{secondary_color}">Total <span style="float:right">{currency} {_fmt_num(total)}</span></p>
    </div>
    {f'<div style="margin-top:24px;padding:18px;background:#1f2937;border-radius:8px;border-left:4px solid {primary_color}"><p style="margin:0;color:#d1d5db;font-size:13px;line-height:1.6"><strong>Notes</strong><br/>{notes}</p></div>' if notes else ''}
    {payment_html}
    {banking_html}
    <p style="margin-top:40px;padding-top:24px;border-top:1px solid #374151;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6">{footer_text}</p>
  </div>
</body>
</html>
"""


def _theme_professional(
  title: str,
  doc_label: str,
  doc_number: int,
  customer_name: str,
  customer_email: str | None,
  issue_date: date,
  due_date: date | None,
  currency: str,
  subtotal: float,
  vat_amount: float,
  total: float,
  vat_rate: float | None,
  vat_country: str | None,
  notes: str | None,
  lines: list[dict],
  company_name: str,
  logo_url: str,
  company_address: str,
  footer_text: str,
  banking_html: str = "",
  payment_html: str = "",
  bill_to_extra: str = "",
  discount_amount: float = 0,
  discount_percent: float | None = None,
  density: dict | None = None,
  primary_color: str = "#1e40af",
  secondary_color: str = "#1e3a5f",
) -> str:
  rows = "".join(
    f"""
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0">{line.get('description', '')}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right">{_fmt_num(line.get('quantity'))}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right">{_fmt_num(line.get('unit_price'))}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:{primary_color}">{_fmt_num(line.get('line_total'))}</td>
    </tr>"""
    for line in lines
  )
  return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>{doc_label} #{doc_number}</title>{_head_css(density or _line_density(lines))}</head>
<body style="font-family:'Segoe UI',system-ui,sans-serif;max-width:720px;margin:0 auto;padding:0;color:#1e293b;background:#fff">
  <div style="background:linear-gradient(180deg,{secondary_color} 0%,{primary_color} 100%);color:#fff;padding:28px 36px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="background:rgba(255,255,255,0.15);padding:8px;border-radius:6px">{_logo_img(logo_url, 46)}</div>
      <div>
        <h1 style="margin:0;font-size:20px;font-weight:600">{company_name}</h1>
        {f'<p style="margin:4px 0 0;font-size:12px;opacity:0.9">{company_address}</p>' if company_address else ''}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;opacity:0.9;text-transform:uppercase">{doc_label}</div>
      <div style="font-size:22px;font-weight:700">#{str(doc_number).zfill(5)}</div>
    </div>
  </div>
  <div style="padding:36px;border:1px solid #e2e8f0;border-top:none">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:24px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e2e8f0">
      <div>
        <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Bill to</p>
        <p style="margin:6px 0 0;font-weight:600;font-size:15px;color:#1e293b">{customer_name}</p>
        {f'<p style="margin:4px 0 0;color:#64748b;font-size:13px">{customer_email}</p>' if customer_email else ''}{bill_to_extra}
      </div>
      <div style="text-align:right;font-size:13px;color:#475569">
        <p style="margin:0"><strong>Issue date</strong> {_fmt_date(issue_date)}</p>
        <p style="margin:8px 0 0"><strong>Due date</strong> {_fmt_date(due_date)}</p>
      </div>
    </div>
    <table class="inv-lines" style="width:100%;border-collapse:collapse">
      {_lines_colgroup()}
      <thead><tr style="background:#f1f5f9;color:#475569;text-transform:uppercase;font-weight:600">
        <th style="text-align:left">Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit price</th>
        <th style="text-align:right">Amount</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <div class="inv-totals" style="margin-top:24px;text-align:right;background:#f8fafc;padding:20px 24px;border-radius:6px;border:1px solid #e2e8f0">
      <p style="margin:0 0 8px;color:#64748b">Subtotal <span style="float:right;font-weight:600;color:#1e293b">{currency} {_fmt_num(subtotal)}</span></p>
      {f'<p style="margin:0 0 8px;color:#64748b">Discount{f" ({_fmt_num(discount_percent)}%)" if discount_percent else ""} <span style="float:right;font-weight:600;color:#1e293b">-{currency} {_fmt_num(discount_amount)}</span></p>' if discount_amount else ''}
      <p style="margin:0 0 8px;color:#64748b">VAT <span style="float:right;font-weight:600;color:#1e293b">{currency} {_fmt_num(vat_amount)}</span></p>
      <p class="grand" style="margin:14px 0 0;font-size:18px;font-weight:700;color:{primary_color};padding-top:12px;border-top:1px solid #e2e8f0">Total <span style="float:right">{currency} {_fmt_num(total)}</span></p>
    </div>
    {f'<div style="margin-top:24px;padding:16px;background:#f8fafc;border-radius:6px;border-left:4px solid {primary_color}"><p style="margin:0;color:#475569;font-size:13px;line-height:1.6"><strong>Notes</strong><br/>{notes}</p></div>' if notes else ''}
    {payment_html}
    {banking_html}
    <p style="margin-top:36px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;line-height:1.6">{footer_text}</p>
  </div>
</body>
</html>
"""

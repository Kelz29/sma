"""
Send invoice/quotation PDF by email. Uses SMTP when configured (e.g. SMTP_HOST),
otherwise logs and returns without error (dev-friendly).
"""
import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)

# SmartSeen brand colours (emerald/slate)
_EMAIL_PRIMARY = "#059669"
_EMAIL_BG = "#0f172a"
_EMAIL_CARD = "#1e293b"
_EMAIL_TEXT = "#f1f5f9"
_EMAIL_MUTED = "#94a3b8"
_EMAIL_FOOTER = "#64748b"


def _smartseen_html_footer() -> str:
  return (
    '<p style="margin:24px 0 0;font-size:12px;color:' + _EMAIL_FOOTER + ';">'
    "Powered by <strong>Smart Macmane</strong>"
    "</p>"
  )


def send_welcome_email(
  *,
  to_email: str,
  full_name: str | None = None,
  verify_url: str | None = None,
) -> None:
  """
  Send a welcome email after registration. SmartSeen-themed HTML with
  "Powered by Smart Macmane" in the footer. Optionally include verify-email link.
  """
  subject = "Welcome to SmartSeen"
  if not _smtp_configured():
    logger.info("Welcome email not sent (SMTP not configured): %s to %s", subject, to_email)
    return

  host = getattr(settings, "SMTP_HOST", "")
  port = int(getattr(settings, "SMTP_PORT", "587"))
  user = getattr(settings, "SMTP_USER", "")
  password = getattr(settings, "SMTP_PASSWORD", "")
  from_addr = getattr(settings, "SMTP_FROM", user or "noreply@example.com")

  display_name = (full_name or "").strip() or "there"
  verify_block = ""
  if verify_url:
    verify_block = (
      '<p style="margin:20px 0 0;font-size:14px;color:' + _EMAIL_TEXT + ';">'
      'Confirm your email to get the most out of SmartSeen: '
      '<a href="' + verify_url + '" style="color:' + _EMAIL_PRIMARY + ';font-weight:600;">Verify my email</a>'
      "</p>"
    )

  html = (
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:' + _EMAIL_BG + ';font-family:system-ui,sans-serif;">'
    '<div style="max-width:480px;margin:0 auto;padding:32px 24px;">'
    '<div style="background:' + _EMAIL_CARD + ';border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">'
    '<div style="text-align:center;margin-bottom:24px;">'
    '<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:rgba(5,150,105,0.2);color:#34d399;font-size:24px;font-weight:700;">S</span>'
    '<p style="margin:12px 0 0;font-size:18px;font-weight:600;color:' + _EMAIL_TEXT + ';">SmartSeen</p>'
    "</div>"
    '<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:' + _EMAIL_TEXT + ';">Welcome, ' + display_name + '</h1>'
    '<p style="margin:0;font-size:15px;line-height:1.5;color:' + _EMAIL_MUTED + ';">'
    "You're in. Your business is set up on SmartSeen — one place for accounting, HR, payroll and employee recognition."
    "</p>"
    + verify_block +
    "</div>"
    + _smartseen_html_footer() +
    "</div></body></html>"
  )

  plain = (
    f"Welcome, {display_name}.\n\n"
    "You're in. Your business is set up on SmartSeen — one place for accounting, HR, payroll and employee recognition.\n\n"
  )
  if verify_url:
    plain += f"Confirm your email: {verify_url}\n\n"
  plain += "Powered by Smart Macmane\n"

  msg = MIMEMultipart("alternative")
  msg["Subject"] = subject
  msg["From"] = from_addr
  msg["To"] = to_email
  msg.attach(MIMEText(plain, "plain"))
  msg.attach(MIMEText(html, "html"))

  try:
    import smtplib
    with smtplib.SMTP(host, port) as smtp:
      if port == 587:
        smtp.starttls()
      if user and password:
        smtp.login(user, password)
      smtp.sendmail(from_addr, [to_email], msg.as_string())
    logger.info("Welcome email sent to %s", to_email)
  except Exception as e:
    logger.exception("Failed to send welcome email to %s: %s", to_email, e)
    raise


def _smtp_configured() -> bool:
  host = getattr(settings, "SMTP_HOST", None)
  return bool(host and isinstance(host, str) and host.strip())


def send_invoice_email(
  *,
  to_email: str,
  invoice_number: int,
  pdf_bytes: bytes,
  doctype: str = "invoice",
) -> None:
  label = "Quotation" if doctype == "quotation" else "Invoice"
  subject = f"{label} #{invoice_number}"

  if not _smtp_configured():
    logger.info("Email not sent (SMTP not configured): %s to %s", subject, to_email)
    return

  host = getattr(settings, "SMTP_HOST", "")
  port = int(getattr(settings, "SMTP_PORT", "587"))
  user = getattr(settings, "SMTP_USER", "")
  password = getattr(settings, "SMTP_PASSWORD", "")
  from_addr = getattr(settings, "SMTP_FROM", user or "noreply@example.com")

  msg = MIMEMultipart()
  msg["Subject"] = subject
  msg["From"] = from_addr
  msg["To"] = to_email
  msg.attach(MIMEText(f"Please find your {label.lower()} #{invoice_number} attached.", "plain"))
  part = MIMEApplication(pdf_bytes, _subtype="pdf")
  part.add_header("Content-Disposition", "attachment", filename=f"{doctype}-{invoice_number}.pdf")
  msg.attach(part)

  try:
    import smtplib
    with smtplib.SMTP(host, port) as smtp:
      if port == 587:
        smtp.starttls()
      if user and password:
        smtp.login(user, password)
      smtp.sendmail(from_addr, [to_email], msg.as_string())
    logger.info("Email sent: %s to %s", subject, to_email)
  except Exception as e:
    logger.exception("Failed to send email to %s: %s", to_email, e)
    raise


def send_report_email(
  *,
  to_email: str,
  subject: str,
  body: str,
  attachment_bytes: bytes,
  filename: str,
) -> None:
  if not _smtp_configured():
    logger.info("Report email not sent (SMTP not configured): %s to %s", subject, to_email)
    return

  host = getattr(settings, "SMTP_HOST", "")
  port = int(getattr(settings, "SMTP_PORT", "587"))
  user = getattr(settings, "SMTP_USER", "")
  password = getattr(settings, "SMTP_PASSWORD", "")
  from_addr = getattr(settings, "SMTP_FROM", user or "noreply@example.com")

  msg = MIMEMultipart()
  msg["Subject"] = subject
  msg["From"] = from_addr
  msg["To"] = to_email
  msg.attach(MIMEText(body or "", "plain"))
  part = MIMEApplication(attachment_bytes, _subtype="csv")
  part.add_header("Content-Disposition", "attachment", filename=filename)
  msg.attach(part)

  try:
    import smtplib
    with smtplib.SMTP(host, port) as smtp:
      if port == 587:
        smtp.starttls()
      if user and password:
        smtp.login(user, password)
      smtp.sendmail(from_addr, [to_email], msg.as_string())
    logger.info("Report email sent: %s to %s", subject, to_email)
  except Exception as e:
    logger.exception("Failed to send report email to %s: %s", to_email, e)
    raise

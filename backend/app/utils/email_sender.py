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

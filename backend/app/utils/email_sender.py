"""
Send transactional email via SMTP. Used by the email worker (and sync fallback).

When SMTP_HOST is unset, send helpers log and return without error (dev-friendly).
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from app.core.config import settings

logger = logging.getLogger(__name__)

_EMAIL_PRIMARY = "#059669"
_EMAIL_BG = "#0f172a"
_EMAIL_CARD = "#1e293b"
_EMAIL_TEXT = "#f1f5f9"
_EMAIL_MUTED = "#94a3b8"
_EMAIL_FOOTER = "#64748b"


def _smtp_configured() -> bool:
  host = getattr(settings, "SMTP_HOST", None)
  return bool(host and isinstance(host, str) and host.strip())


def _from_addr() -> str:
  """Display From header, e.g. 'SmartSeen <support@smartseen.co.za>'."""
  user = getattr(settings, "SMTP_USER", "") or ""
  raw_from = (
    getattr(settings, "SMTP_FROM", None)
    or getattr(settings, "SMTP_FROM_EMAIL", None)
    or user
    or "noreply@example.com"
  )
  name = (
    getattr(settings, "SMTP_FROM_NAME", None)
    or getattr(settings, "EMAIL_FROM_NAME", None)
    or ""
  ).strip()
  # If SMTP_FROM already looks like "Name <email>", keep it.
  if "<" in raw_from and ">" in raw_from:
    return raw_from
  if name and "@" in raw_from:
    return formataddr((name, raw_from))
  return raw_from


def _envelope_from() -> str:
  """Bare email for SMTP MAIL FROM (SES rejects display-name envelopes)."""
  header = _from_addr()
  if "<" in header and ">" in header:
    return header.split("<", 1)[1].split(">", 1)[0].strip()
  email = (
    getattr(settings, "SMTP_FROM_EMAIL", None)
    or getattr(settings, "SMTP_FROM", None)
    or ""
  ).strip()
  if email and "@" in email and "<" not in email:
    return email
  return header


def _smartseen_html_footer() -> str:
  return (
    '<p style="margin:24px 0 0;font-size:12px;color:' + _EMAIL_FOOTER + ';">'
    "Powered by <strong>Smart Macmane</strong>"
    "</p>"
  )


def _branded_shell(title: str, body_html: str) -> str:
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
    '<body style="margin:0;background:' + _EMAIL_BG + ';font-family:system-ui,sans-serif;">'
    '<div style="max-width:480px;margin:0 auto;padding:32px 24px;">'
    '<div style="background:' + _EMAIL_CARD + ';border-radius:16px;padding:32px;'
    'border:1px solid rgba(255,255,255,0.08);">'
    '<div style="text-align:center;margin-bottom:24px;">'
    '<span style="display:inline-flex;align-items:center;justify-content:center;'
    "width:48px;height:48px;border-radius:12px;background:rgba(5,150,105,0.2);"
    'color:#34d399;font-size:24px;font-weight:700;">S</span>'
    '<p style="margin:12px 0 0;font-size:18px;font-weight:600;color:' + _EMAIL_TEXT + ';">SmartSeen</p>'
    "</div>"
    '<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:' + _EMAIL_TEXT + ';">'
    + title
    + "</h1>"
    + body_html
    + "</div>"
    + _smartseen_html_footer()
    + "</div></body></html>"
  )


def _send_smtp(msg: MIMEMultipart, to_email: str) -> None:
  if not _smtp_configured():
    logger.info("Email not sent (SMTP not configured): %s to %s", msg["Subject"], to_email)
    return

  host = (settings.SMTP_HOST or "").strip()
  port = int(settings.SMTP_PORT or 587)
  user = settings.SMTP_USER or ""
  password = settings.SMTP_PASSWORD or ""
  use_ssl = bool(getattr(settings, "SMTP_USE_SSL", False)) or port == 465

  if use_ssl:
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(host, port, context=context) as smtp:
      if user and password:
        smtp.login(user, password)
      smtp.sendmail(_envelope_from(), [to_email], msg.as_string())
  else:
    with smtplib.SMTP(host, port, timeout=30) as smtp:
      if port == 587 or not use_ssl:
        smtp.starttls(context=ssl.create_default_context())
      if user and password:
        smtp.login(user, password)
      smtp.sendmail(_envelope_from(), [to_email], msg.as_string())


def send_welcome_email(
  *,
  to_email: str,
  full_name: str | None = None,
  verify_url: str | None = None,
) -> None:
  """Welcome email after registration; optional verify-email link."""
  subject = "Welcome to SmartSeen"
  display_name = (full_name or "").strip() or "there"
  verify_block = ""
  if verify_url:
    verify_block = (
      '<p style="margin:20px 0 0;font-size:14px;color:' + _EMAIL_TEXT + ';">'
      "Confirm your email to get the most out of SmartSeen: "
      '<a href="' + verify_url + '" style="color:' + _EMAIL_PRIMARY + ';font-weight:600;">Verify my email</a>'
      "</p>"
    )
  body = (
    '<p style="margin:0;font-size:15px;line-height:1.5;color:' + _EMAIL_MUTED + ';">'
    "You're in. Your business is set up on SmartSeen — one place for accounting, HR, payroll and employee recognition."
    "</p>"
    + verify_block
  )
  html = _branded_shell(f"Welcome, {display_name}", body)
  plain = (
    f"Welcome, {display_name}.\n\n"
    "You're in. Your business is set up on SmartSeen — one place for accounting, HR, payroll and employee recognition.\n\n"
  )
  if verify_url:
    plain += f"Confirm your email: {verify_url}\n\n"
  plain += "Powered by Smart Macmane\n"

  msg = MIMEMultipart("alternative")
  msg["Subject"] = subject
  msg["From"] = _from_addr()
  msg["To"] = to_email
  msg.attach(MIMEText(plain, "plain"))
  msg.attach(MIMEText(html, "html"))

  try:
    _send_smtp(msg, to_email)
    if _smtp_configured():
      logger.info("Welcome email sent to %s", to_email)
  except Exception as e:
    logger.exception("Failed to send welcome email to %s: %s", to_email, e)
    raise


def send_email_confirmed(*, to_email: str, full_name: str | None = None) -> None:
  """Sent after the user successfully verifies their email."""
  subject = "Your email is confirmed — SmartSeen"
  display_name = (full_name or "").strip() or "there"
  body = (
    '<p style="margin:0;font-size:15px;line-height:1.5;color:' + _EMAIL_MUTED + ';">'
    f"Thanks, {display_name}. Your email address is confirmed. You're all set to use SmartSeen."
    "</p>"
  )
  html = _branded_shell("Email confirmed", body)
  plain = (
    f"Thanks, {display_name}. Your email address is confirmed. You're all set to use SmartSeen.\n\n"
    "Powered by Smart Macmane\n"
  )

  msg = MIMEMultipart("alternative")
  msg["Subject"] = subject
  msg["From"] = _from_addr()
  msg["To"] = to_email
  msg.attach(MIMEText(plain, "plain"))
  msg.attach(MIMEText(html, "html"))

  try:
    _send_smtp(msg, to_email)
    if _smtp_configured():
      logger.info("Email confirmed message sent to %s", to_email)
  except Exception as e:
    logger.exception("Failed to send email-confirmed to %s: %s", to_email, e)
    raise


def send_invoice_email(
  *,
  to_email: str,
  invoice_number: int,
  pdf_bytes: bytes,
  doctype: str = "invoice",
) -> None:
  label = "Quotation" if doctype == "quotation" else "Invoice"
  subject = f"{label} #{invoice_number}"

  msg = MIMEMultipart()
  msg["Subject"] = subject
  msg["From"] = _from_addr()
  msg["To"] = to_email
  msg.attach(MIMEText(f"Please find your {label.lower()} #{invoice_number} attached.", "plain"))
  part = MIMEApplication(pdf_bytes, _subtype="pdf")
  part.add_header("Content-Disposition", "attachment", filename=f"{doctype}-{invoice_number}.pdf")
  msg.attach(part)

  try:
    _send_smtp(msg, to_email)
    if _smtp_configured():
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
  msg = MIMEMultipart()
  msg["Subject"] = subject
  msg["From"] = _from_addr()
  msg["To"] = to_email
  msg.attach(MIMEText(body or "", "plain"))
  part = MIMEApplication(attachment_bytes, _subtype="csv")
  part.add_header("Content-Disposition", "attachment", filename=filename)
  msg.attach(part)

  try:
    _send_smtp(msg, to_email)
    if _smtp_configured():
      logger.info("Report email sent: %s to %s", subject, to_email)
  except Exception as e:
    logger.exception("Failed to send report email to %s: %s", to_email, e)
    raise


def dispatch_outbox_payload(kind: str, to_email: str, payload: dict) -> None:
  """Render and send an outbox job by kind."""
  if kind == "welcome_verify":
    send_welcome_email(
      to_email=to_email,
      full_name=payload.get("full_name"),
      verify_url=payload.get("verify_url"),
    )
    return
  if kind == "email_confirmed":
    send_email_confirmed(to_email=to_email, full_name=payload.get("full_name"))
    return
  if kind == "invoice":
    import base64

    pdf_b64 = payload.get("pdf_base64") or ""
    send_invoice_email(
      to_email=to_email,
      invoice_number=int(payload.get("invoice_number") or 0),
      pdf_bytes=base64.b64decode(pdf_b64) if pdf_b64 else b"",
      doctype=payload.get("doctype") or "invoice",
    )
    return
  if kind == "report":
    import base64

    data_b64 = payload.get("attachment_base64") or ""
    send_report_email(
      to_email=to_email,
      subject=payload.get("subject") or "Report",
      body=payload.get("body") or "",
      attachment_bytes=base64.b64decode(data_b64) if data_b64 else b"",
      filename=payload.get("filename") or "report.csv",
    )
    return
  raise ValueError(f"Unknown email kind: {kind}")

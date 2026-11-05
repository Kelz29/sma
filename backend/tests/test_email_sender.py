"""Regression: mail servers that don't answer QUIT with 221 must not fail sends.

Python 3.13+ smtplib.__exit__ raises SMTPResponseException when QUIT returns
anything but 221; spe.ucebox.co.za replies "250 Reset OK", which marked
delivered welcome emails as failed in the outbox (users got no mail, or
duplicates on retry). _send_smtp must close best-effort instead.
"""
from __future__ import annotations

import smtplib
from unittest.mock import patch

from app.utils import email_sender


class _FakeSMTP:
  instances: list["_FakeSMTP"] = []

  def __init__(self, *args, **kwargs):
    self.sent: list[tuple] = []
    self.logged_in = False
    _FakeSMTP.instances.append(self)

  def __enter__(self):
    return self

  def __exit__(self, *args):
    # What Python 3.13+ smtplib does when QUIT is not answered with 221.
    raise smtplib.SMTPResponseException(250, b"Reset OK")

  def login(self, user, password):
    self.logged_in = True

  def sendmail(self, from_addr, to_addrs, msg):
    self.sent.append((from_addr, to_addrs, msg))
    return {}

  def starttls(self, context=None):
    pass

  def quit(self):
    # Non-221 QUIT reply, as spe.ucebox.co.za does.
    raise smtplib.SMTPResponseException(250, b"Reset OK")

  def close(self):
    pass


def test_send_survives_non_221_quit() -> None:
  _FakeSMTP.instances.clear()
  with (
    patch.object(email_sender.settings, "SMTP_HOST", "spe.ucebox.co.za"),
    patch.object(email_sender.settings, "SMTP_PORT", 465),
    patch.object(email_sender.settings, "SMTP_USER", "app-no-reply@smartseen.co.za"),
    patch.object(email_sender.settings, "SMTP_PASSWORD", "secret"),
    patch.object(email_sender.settings, "SMTP_USE_SSL", True),
    patch("smtplib.SMTP_SSL", _FakeSMTP),
  ):
    # Must not raise even though quit() raises SMTPResponseException(250).
    email_sender.send_welcome_email(
      to_email="new-user@example.com",
      full_name="New User",
      verify_url="https://app.smartseen.co.za/verify-email?token=abc",
    )
  assert len(_FakeSMTP.instances) == 1
  fake = _FakeSMTP.instances[0]
  assert fake.logged_in
  assert len(fake.sent) == 1
  assert fake.sent[0][1] == ["new-user@example.com"]

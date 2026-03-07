from typing import Iterable

try:
  from weasyprint import HTML
  _weasyprint_available = True
except ImportError:
  HTML = None  # type: ignore
  _weasyprint_available = False


def render_invoice_pdf(*, html_body: str) -> bytes:
  """
  Render invoice HTML into a PDF and return raw bytes.
  In production you might inject a template engine and filesystem storage.
  """
  if not _weasyprint_available:
    raise RuntimeError("weasyprint is not installed; pip install weasyprint to enable PDF export")
  pdf = HTML(string=html_body).write_pdf()  # type: ignore
  return pdf


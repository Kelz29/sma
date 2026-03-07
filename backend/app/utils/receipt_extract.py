"""
AI receipt data extraction. Uses OpenAI vision when OPENAI_API_KEY is set;
otherwise returns placeholder data for development.
"""
import base64
import os
import re
from typing import Any

# Optional: from openai import OpenAI


def _stub_extraction(file_name: str, content_type: str) -> dict[str, Any]:
  """Return placeholder extracted data when no AI is configured."""
  return {
    "merchant": "Merchant (review receipt)",
    "amount": 0.0,
    "date": None,
    "currency": "ZAR",
    "line_items": [],
    "suggested_category": None,
    "raw_text_preview": None,
    "confidence": "low",
  }


def _extract_amount_from_text(text: str) -> float | None:
  """Heuristic: find a total/amount pattern like 123.45 or 1,234.56."""
  if not text:
    return None
  # Match numbers that look like currency (with optional comma, 2 decimal places)
  patterns = [
    r"total[:\s]*[\$]?\s*([\d,]+\.?\d*)",
    r"amount[:\s]*[\$]?\s*([\d,]+\.?\d*)",
    r"[\$]\s*([\d,]+\.\d{2})\b",
    r"\b([\d,]+\.\d{2})\s*(?:USD|ZAR|EUR)?\s*$",
  ]
  for pat in patterns:
    m = re.search(pat, text, re.IGNORECASE)
    if m:
      try:
        return float(m.group(1).replace(",", ""))
      except ValueError:
        continue
  return None


def extract_receipt_data(image_bytes: bytes, file_name: str = "", content_type: str = "") -> dict[str, Any]:
  """
  Extract structured data from a receipt image.
  Returns dict with keys: merchant, amount, date, currency, line_items, suggested_category, raw_text_preview, confidence.
  """
  api_key = os.environ.get("OPENAI_API_KEY", "").strip()
  if api_key:
    try:
      return _extract_with_openai(image_bytes, file_name, content_type, api_key)
    except Exception:
      pass
  return _stub_extraction(file_name, content_type)


def _extract_with_openai(
  image_bytes: bytes,
  file_name: str,
  content_type: str,
  api_key: str,
) -> dict[str, Any]:
  """Use OpenAI vision (gpt-4o or gpt-4-vision) to extract receipt fields."""
  try:
    from openai import OpenAI
  except ImportError:
    return _stub_extraction(file_name, content_type)

  client = OpenAI(api_key=api_key)
  b64 = base64.standard_b64encode(image_bytes).decode("ascii")
  media_type = "image/jpeg" if "jpeg" in content_type or "jpg" in content_type else "image/png"

  response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": (
              "Extract receipt data and respond with a JSON object only (no markdown). Use these exact keys: "
              '"merchant" (string, business name), "amount" (number, total amount), "date" (string YYYY-MM-DD or null), '
              '"currency" (string, e.g. ZAR or LSL), "line_items" (array of { "description": string, "amount": number }), '
              '"suggested_category" (string, one word category like Travel, Meals, Office, Supplies, or null). '
              "If a value is unknown use null. For amount use the total/grand total."
            ),
          },
          {
            "type": "image_url",
            "image_url": {"url": f"data:{media_type};base64,{b64}"},
          },
        ],
      },
    ],
  )
  import json
  raw = (response.choices[0].message.content or "").strip()
  # Strip markdown code block if present
  if raw.startswith("```"):
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
  try:
    data = json.loads(raw)
  except json.JSONDecodeError:
    return _stub_extraction(file_name, content_type)

  return {
    "merchant": data.get("merchant"),
    "amount": data.get("amount"),
    "date": data.get("date"),
    "currency": data.get("currency") or "ZAR",
    "line_items": data.get("line_items") or [],
    "suggested_category": data.get("suggested_category"),
    "raw_text_preview": raw[:500] if raw else None,
    "confidence": "high",
  }

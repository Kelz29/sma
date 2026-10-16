"""Rank features from first-party events. No separate model service."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models.tenant import Tenant
from app.db.models.usage import UsageEvent

WINDOW_DAYS = 14
ERROR_RATE_FIX = 0.25

FEATURES = [
  {
    "key": "invoices",
    "label": "Invoices",
    "paths": ["/invoices"],
    "actions": ["invoice_created", "invoice_pdf", "payment_recorded"],
    "api_prefixes": ["/api/v1/invoices"],
  },
  {
    "key": "customers",
    "label": "Customers",
    "paths": ["/customers", "/statements"],
    "actions": ["customer_created"],
    "api_prefixes": ["/api/v1/customers"],
  },
  {
    "key": "expenses",
    "label": "Expenses",
    "paths": ["/expenses"],
    "actions": ["expense_created"],
    "api_prefixes": ["/api/v1/expenses"],
  },
  {
    "key": "banking",
    "label": "Banking",
    "paths": ["/banking"],
    "actions": [],
    "api_prefixes": ["/api/v1/banking"],
  },
  {
    "key": "reports",
    "label": "Reports",
    "paths": ["/reports"],
    "actions": [],
    "api_prefixes": ["/api/v1/reports"],
  },
  {
    "key": "hr",
    "label": "HR",
    "paths": ["/employees"],
    "actions": [],
    "api_prefixes": ["/api/v1/employees", "/api/v1/leave", "/api/v1/attendance"],
  },
  {
    "key": "payslips",
    "label": "Payslips",
    "paths": ["/payslips"],
    "actions": [],
    "api_prefixes": ["/api/v1/payslips"],
  },
  {
    "key": "team",
    "label": "Team",
    "paths": ["/team"],
    "actions": ["team_user_invited"],
    "api_prefixes": ["/api/v1/company"],
  },
  {
    "key": "pdf_editor",
    "label": "PDF editor",
    "paths": ["/pdf-editor"],
    "actions": ["pdf_editor_download"],
    "api_prefixes": [],
  },
]


def _matches_prefix(path: str, prefixes: list[str]) -> bool:
  return any(path == prefix or path.startswith(prefix + "/") for prefix in prefixes)


def feature_key_for(event: UsageEvent) -> str | None:
  if event.action:
    for feature in FEATURES:
      if event.action in feature["actions"]:
        return feature["key"]
  if event.kind == "page_view":
    for feature in FEATURES:
      if _matches_prefix(event.path, feature["paths"]):
        return feature["key"]
  if event.kind in ("api_error", "client_error"):
    for feature in FEATURES:
      if _matches_prefix(event.path, feature["paths"]) or _matches_prefix(event.path, feature["api_prefixes"]):
        return feature["key"]
  return None


def _median(values: list[float]) -> float:
  if not values:
    return 0.0
  ordered = sorted(values)
  mid = len(ordered) // 2
  if len(ordered) % 2:
    return ordered[mid]
  return (ordered[mid - 1] + ordered[mid]) / 2


def _join_names(names: list[str]) -> str:
  if not names:
    return ""
  if len(names) == 1:
    return names[0]
  if len(names) == 2:
    return f"{names[0]} and {names[1]}"
  return f"{', '.join(names[:-1])}, and {names[-1]}"


def build_summary(db: Session, now: datetime | None = None) -> dict:
  now = now or datetime.utcnow()
  start = now - timedelta(days=WINDOW_DAYS)
  events = (
    db.query(UsageEvent)
    .filter(UsageEvent.created_at >= start)
    .all()
  )
  active_ids = {event.tenant_id for event in events if event.tenant_id is not None}
  active_count = len(active_ids)
  distinct_days = {event.created_at.date() for event in events}
  single_day = len(distinct_days) <= 1

  by_tenant: dict[int, list[UsageEvent]] = {}
  for event in events:
    if event.tenant_id is None:
      continue
    by_tenant.setdefault(event.tenant_id, []).append(event)

  def tenants_with_action(names: set[str]) -> set[int]:
    found: set[int] = set()
    for tenant_id, rows in by_tenant.items():
      if any(row.kind == "action" and row.action in names for row in rows):
        found.add(tenant_id)
    return found

  signed_in = tenants_with_action({"signed_in", "registered"})
  created = tenants_with_action({"invoice_created"})
  onboarding_gap = len(signed_in) >= 2 and (len(created) / len(signed_in)) < 0.5

  feature_rows = []
  for feature in FEATURES:
    key = feature["key"]
    matched = [event for event in events if feature_key_for(event) == key]
    views = [event for event in matched if event.kind == "page_view"]
    actions = [event for event in matched if event.kind == "action"]
    errors = [event for event in matched if event.kind in ("client_error", "api_error")]
    used_ids = {event.tenant_id for event in views + actions if event.tenant_id is not None}
    adoption = (len(used_ids) / active_count) if active_count else 0.0
    frequency = ((len(views) + len(actions)) / active_count) if active_count else 0.0
    opens = len(views) + len(actions)
    error_rate = (len(errors) / opens) if opens else 0.0

    def came_back(tenant_id: int, used: bool) -> bool:
      rows = by_tenant.get(tenant_id, [])
      if used:
        feature_days = [row.created_at for row in rows if feature_key_for(row) == key and row.kind in ("page_view", "action")]
        if not feature_days:
          return False
        first = min(feature_days).date()
        return any(row.created_at.date() > first for row in rows)
      days = {row.created_at.date() for row in rows}
      return len(days) >= 2

    if not used_ids:
      return_lift = 0.0
    elif single_day:
      return_lift = 1.0
    else:
      used_return = sum(1 for tenant_id in used_ids if came_back(tenant_id, True)) / len(used_ids)
      unused_ids = active_ids - used_ids
      unused_return = (
        sum(1 for tenant_id in unused_ids if came_back(tenant_id, False)) / len(unused_ids)
        if unused_ids
        else 0.0
      )
      return_lift = used_return - unused_return

    score = adoption * frequency * return_lift
    feature_rows.append(
      {
        "key": key,
        "label": feature["label"],
        "adoption": round(adoption, 4),
        "frequency": round(frequency, 4),
        "return_lift": round(return_lift, 4),
        "error_rate": round(error_rate, 4),
        "score": round(score, 4),
        "opens": opens,
        "_score": score,
        "_lift": return_lift,
        "_error_rate": error_rate,
      }
    )

  positive = [row["_score"] for row in feature_rows if row["_score"] > 0]
  median = _median(positive)
  for row in feature_rows:
    if row["_error_rate"] >= ERROR_RATE_FIX and row["opens"] > 0:
      kind = "fix_first"
    elif row["key"] == "invoices" and onboarding_gap:
      kind = "onboarding_gap"
    elif row["_score"] > 0 and row["_score"] >= median and row["_lift"] > 0:
      kind = "build_on"
    elif row["adoption"] == 0:
      kind = "leave_for_later"
    else:
      kind = "watch"
    row["label_kind"] = kind
    row.pop("_score")
    row.pop("_lift")
    row.pop("_error_rate")
    row.pop("opens")

  feature_rows.sort(key=lambda row: row["score"], reverse=True)

  def names(kind: str) -> list[str]:
    ordered = [feature["label"] for feature in FEATURES]
    return [row["label"] for row in feature_rows if row["label_kind"] == kind and row["label"] in ordered]

  focus: list[str] = []
  if active_count == 0:
    focus.append("No usage yet. Scores appear after businesses sign in and use the product.")
  else:
    fix_names = names("fix_first")
    build_names = names("build_on")
    later_names = names("leave_for_later")
    if fix_names:
      focus.append(f"Fix {_join_names(fix_names)} first. People open them and they error often.")
    if onboarding_gap:
      focus.append("Many businesses sign in and few create a first invoice.")
    if build_names:
      focus.append(f"Build on {_join_names(build_names)}. Businesses that use them come back.")
    if later_names and len(focus) < 3:
      focus.append(f"Leave {_join_names(later_names)} for later. Almost nobody uses them.")
  focus = focus[:3]

  opened = {
    tenant_id
    for tenant_id, rows in by_tenant.items()
    if any(row.kind == "page_view" and _matches_prefix(row.path, ["/invoices"]) for row in rows)
  }
  finished = tenants_with_action({"invoice_pdf", "payment_recorded", "pdf_editor_download"})
  funnel = [
    {"key": "signed_in", "label": "Signed in", "tenants": len(signed_in)},
    {"key": "opened_invoices", "label": "Opened invoices", "tenants": len(opened)},
    {"key": "invoice_created", "label": "Created an invoice", "tenants": len(created)},
    {"key": "pdf_or_payment", "label": "Downloaded a PDF or recorded a payment", "tenants": len(finished)},
  ]

  today = now.date()
  daily = []
  for offset in range(WINDOW_DAYS - 1, -1, -1):
    day = today - timedelta(days=offset)
    count = len({event.tenant_id for event in events if event.tenant_id is not None and event.created_at.date() == day})
    daily.append({"date": day.isoformat(), "active_tenants": count})

  tenant_names = {
    tenant.id: tenant.name
    for tenant in db.query(Tenant).filter(Tenant.id.in_(active_ids or {0})).all()
  }
  tenant_rows = []
  for tenant_id, rows in by_tenant.items():
    last_seen = max(row.created_at for row in rows)
    used = []
    for feature in FEATURES:
      if any(feature_key_for(row) == feature["key"] and row.kind in ("page_view", "action") for row in rows):
        used.append(feature["label"])
    tenant_rows.append(
      {
        "tenant_id": tenant_id,
        "tenant_name": tenant_names.get(tenant_id, "Unknown"),
        "last_seen": last_seen,
        "features": used,
        "error_count": sum(1 for row in rows if row.kind in ("client_error", "api_error")),
      }
    )
  tenant_rows.sort(key=lambda row: row["last_seen"], reverse=True)

  return {
    "days": WINDOW_DAYS,
    "active_tenants": active_count,
    "error_count": sum(1 for event in events if event.kind in ("client_error", "api_error")),
    "focus": focus,
    "features": feature_rows,
    "funnel": funnel,
    "daily": daily,
    "tenants": tenant_rows,
  }

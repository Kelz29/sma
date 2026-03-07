from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, Session

from app.db.base import Base


class FeatureFlag(Base):
  """
  Platform-wide feature flags. Only superadmin can change these.
  When enabled=False, the feature is hidden from nav and inaccessible to all users
  (except superadmin who can still see the toggle and access the feature for testing).
  """
  __tablename__ = "feature_flags"

  key: Mapped[str] = mapped_column(String(64), primary_key=True)
  enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
  description: Mapped[str | None] = mapped_column(String(255), nullable=True)


# Canonical list of feature keys used across backend and frontend.
# Accounting and Sales are split into sub-features so each can be toggled individually.
FEATURE_KEYS = [
  "dashboard",
  # Accounting (each sub-feature can be toggled)
  "invoices",
  "expenses",
  "reports",
  "banking",
  "accounts",
  # Sales (each sub-feature can be toggled)
  "leads",
  "proposals",
  "contracts",
  "pitch_decks",
  "pipeline",
  "hr",
  "settings",
  "team",
  "profile",
  "portal",
]

FEATURE_DEFAULTS: dict[str, bool] = {
  "dashboard": True,
  "invoices": True,
  "expenses": True,
  "reports": True,
  "banking": True,
  "accounts": True,
  "leads": True,
  "proposals": True,
  "contracts": True,
  "pitch_decks": True,
  "pipeline": True,
  "hr": True,
  "settings": True,
  "team": True,
  "profile": True,
  "portal": True,
}


def ensure_defaults(db: Session) -> None:
  """Ensure all canonical feature flag rows exist with defaults."""
  for key in FEATURE_KEYS:
    row = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    if not row:
      db.add(FeatureFlag(key=key, enabled=FEATURE_DEFAULTS.get(key, True)))
  db.commit()

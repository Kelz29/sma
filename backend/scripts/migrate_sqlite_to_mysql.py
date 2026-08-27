#!/usr/bin/env python3
"""Copy all tables from local SQLite sma.db into MySQL (DATABASE_URI_OVERRIDE)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Run from backend root
ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, inspect, text, MetaData, Table
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import accounting, tenant, user, hr, sales, feature_flag, waitlist  # noqa: F401


SQLITE_URI = os.environ.get("SQLITE_URI", "sqlite:///./sma.db")
MYSQL_URI = os.environ.get("MYSQL_URI") or settings.SQLALCHEMY_DATABASE_URI

# Parent tables first so FKs succeed when constraints exist
TABLE_ORDER = [
  "tenants",
  "users",
  "tenant_users",
  "feature_flags",
  "waitlist_entries",
  "email_verification_tokens",
  "accounts",
  "customers",
  "vendors",
  "expense_categories",
  "bank_accounts",
  "employees",
  "leave_types",
  "line_item_templates",
  "invoices",
  "invoice_lines",
  "invoice_payments",
  "expenses",
  "expense_receipts",
  "receipt_uploads",
  "bank_transactions",
  "leave_balances",
  "leave_requests",
  "attendance",
  "salary_history",
  "payslips",
  "sales_leads",
  "sales_deals",
  "sales_proposals",
  "sales_contracts",
  "sales_pitch_decks",
  "audit_logs",
]


def main() -> None:
  if "sqlite" in MYSQL_URI:
    print(f"Refusing to migrate into SQLite URI: {MYSQL_URI}", file=sys.stderr)
    sys.exit(1)

  print(f"Source: {SQLITE_URI}")
  print(f"Target: {MYSQL_URI.split('@')[-1] if '@' in MYSQL_URI else MYSQL_URI}")

  src = create_engine(SQLITE_URI, connect_args={"check_same_thread": False})
  dst = create_engine(MYSQL_URI, pool_pre_ping=True)

  # Create schema from SQLAlchemy models
  Base.metadata.create_all(bind=dst)

  src_insp = inspect(src)
  src_tables = set(src_insp.get_table_names())
  ordered = [t for t in TABLE_ORDER if t in src_tables]
  ordered += sorted(src_tables - set(ordered))

  src_meta = MetaData()
  dst_meta = MetaData()
  src_meta.reflect(bind=src)
  dst_meta.reflect(bind=dst)

  with src.connect() as sconn, dst.begin() as dconn:
    # Disable FK checks during bulk load
    dconn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    for name in ordered:
      if name not in dst_meta.tables:
        print(f"  skip {name} (not in MySQL schema)")
        continue
      src_t = src_meta.tables[name]
      dst_t = dst_meta.tables[name]
      rows = sconn.execute(src_t.select()).mappings().all()
      dconn.execute(dst_t.delete())
      if not rows:
        print(f"  {name}: 0 rows")
        continue
      # Only columns that exist on both sides
      common = [c.name for c in src_t.columns if c.name in dst_t.c]
      payload = [{c: row[c] for c in common} for row in rows]
      dconn.execute(dst_t.insert(), payload)
      print(f"  {name}: {len(payload)} rows")
    dconn.execute(text("SET FOREIGN_KEY_CHECKS=1"))

  print("Migration complete.")


if __name__ == "__main__":
  main()

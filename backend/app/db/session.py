from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import accounting, tenant, user, hr, sales, feature_flag  # noqa: F401

_connect_args = {}
if getattr(settings, "USE_SQLITE", False):
  _connect_args["check_same_thread"] = False

engine = create_engine(
  settings.SQLALCHEMY_DATABASE_URI,
  pool_pre_ping=True,
  echo=settings.SQLALCHEMY_ECHO,
  connect_args=_connect_args,
)

if getattr(settings, "USE_SQLITE", False):
  Base.metadata.create_all(bind=engine)
  # Add optional tenant columns if they don't exist (for existing DBs)
  with engine.connect() as conn:
    for col, typ in [
      ("logo_url", "VARCHAR(512)"),
      ("address", "TEXT"),
      ("footer_text", "TEXT"),
      ("bank_name", "VARCHAR(255)"),
      ("bank_account_number", "VARCHAR(100)"),
      ("bank_branch_code", "VARCHAR(20)"),
      ("primary_color", "VARCHAR(20)"),
      ("secondary_color", "VARCHAR(20)"),
      ("default_currency", "VARCHAR(3)"),
      ("default_vat_rate", "REAL"),
      ("default_vat_country", "VARCHAR(2)"),
    ]:
      try:
        conn.execute(text(f"ALTER TABLE tenants ADD COLUMN {col} {typ}"))
        conn.commit()
      except Exception:
        conn.rollback()
    try:
      conn.execute(text("ALTER TABLE invoices ADD COLUMN customer_id INTEGER"))
      conn.commit()
    except Exception:
      conn.rollback()
    try:
      conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
      conn.commit()
    except Exception:
      conn.rollback()
    try:
      conn.execute(text("ALTER TABLE invoices ADD COLUMN uuid VARCHAR(36)"))
      conn.commit()
    except Exception:
      conn.rollback()
else:
  # MySQL (or other DB): ensure optional columns and feature_flags table exist
  with engine.connect() as conn:
    try:
      conn.execute(text("""
        CREATE TABLE IF NOT EXISTS feature_flags (
          `key` VARCHAR(64) PRIMARY KEY,
          enabled TINYINT(1) NOT NULL DEFAULT 1,
          description VARCHAR(255) NULL
        )
      """))
      conn.commit()
    except Exception:
      conn.rollback()
    for stmt in [
      "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL",
      "ALTER TABLE tenants ADD COLUMN bank_name VARCHAR(255) NULL",
      "ALTER TABLE tenants ADD COLUMN bank_account_number VARCHAR(100) NULL",
      "ALTER TABLE tenants ADD COLUMN bank_branch_code VARCHAR(20) NULL",
      "ALTER TABLE tenants ADD COLUMN primary_color VARCHAR(20) NULL",
      "ALTER TABLE tenants ADD COLUMN secondary_color VARCHAR(20) NULL",
      "ALTER TABLE tenants ADD COLUMN default_currency VARCHAR(3) NULL",
      "ALTER TABLE tenants ADD COLUMN default_vat_rate DOUBLE NULL",
      "ALTER TABLE tenants ADD COLUMN default_vat_country VARCHAR(2) NULL",
      "ALTER TABLE invoices ADD COLUMN uuid VARCHAR(36) NULL",
    ]:
      try:
        conn.execute(text(stmt))
        conn.commit()
      except Exception:
        conn.rollback()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


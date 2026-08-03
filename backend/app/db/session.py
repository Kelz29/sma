from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import accounting, tenant, user, hr, sales, feature_flag, waitlist  # noqa: F401

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
      ("company_registration_number", "VARCHAR(100)"),
      ("company_registration_country", "VARCHAR(2)"),
      ("cipc_document_url", "VARCHAR(512)"),
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
      conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0"))
      conn.commit()
    except Exception:
      conn.rollback()
    # Create waitlist and email_verification_tokens if not exist (SQLite create_all will create when models are loaded)
    for create_sql in [
      "CREATE TABLE IF NOT EXISTS waitlist_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, email VARCHAR(255) NOT NULL, created_at DATETIME)",
      "CREATE TABLE IF NOT EXISTS email_verification_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token VARCHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, created_at DATETIME, FOREIGN KEY (user_id) REFERENCES users(id))",
    ]:
      try:
        conn.execute(text(create_sql))
        conn.commit()
      except Exception:
        conn.rollback()
    try:
      conn.execute(text("ALTER TABLE invoices ADD COLUMN uuid VARCHAR(36)"))
      conn.commit()
    except Exception:
      conn.rollback()
    for col, typ in [
      ("address", "TEXT"),
      ("phone", "VARCHAR(50)"),
      ("passport_number", "VARCHAR(50)"),
    ]:
      try:
        conn.execute(text(f"ALTER TABLE employees ADD COLUMN {col} {typ}"))
        conn.commit()
      except Exception:
        conn.rollback()
    for col, typ in [
      ("customer_type", "VARCHAR(20) DEFAULT 'company'"),
      ("phone", "VARCHAR(50)"),
      ("contact_name", "VARCHAR(255)"),
      ("registration_number", "VARCHAR(100)"),
      ("vat_number", "VARCHAR(50)"),
      ("id_number", "VARCHAR(50)"),
    ]:
      try:
        conn.execute(text(f"ALTER TABLE customers ADD COLUMN {col} {typ}"))
        conn.commit()
      except Exception:
        conn.rollback()
    try:
      conn.execute(text("UPDATE customers SET customer_type = 'company' WHERE customer_type IS NULL OR customer_type = ''"))
      conn.commit()
    except Exception:
      conn.rollback()
    for col, typ in [
      ("discount_type", "VARCHAR(20)"),
      ("discount_percent", "REAL"),
      ("discount_amount", "REAL DEFAULT 0"),
    ]:
      try:
        conn.execute(text(f"ALTER TABLE invoices ADD COLUMN {col} {typ}"))
        conn.commit()
      except Exception:
        conn.rollback()
else:
  # MySQL (or other DB): ensure optional columns and feature_flags, waitlist, email_verification tables exist
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
    try:
      conn.execute(text("""
        CREATE TABLE IF NOT EXISTS waitlist_entries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_waitlist_email (email)
        )
      """))
      conn.commit()
    except Exception:
      conn.rollback()
    try:
      conn.execute(text("""
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          token VARCHAR(64) NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ev_token (token),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      """))
      conn.commit()
    except Exception:
      conn.rollback()
    for stmt in [
      "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL",
      "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NULL DEFAULT 0",
      "ALTER TABLE tenants ADD COLUMN bank_name VARCHAR(255) NULL",
      "ALTER TABLE tenants ADD COLUMN bank_account_number VARCHAR(100) NULL",
      "ALTER TABLE tenants ADD COLUMN bank_branch_code VARCHAR(20) NULL",
      "ALTER TABLE tenants ADD COLUMN primary_color VARCHAR(20) NULL",
      "ALTER TABLE tenants ADD COLUMN secondary_color VARCHAR(20) NULL",
      "ALTER TABLE tenants ADD COLUMN default_currency VARCHAR(3) NULL",
      "ALTER TABLE tenants ADD COLUMN default_vat_rate DOUBLE NULL",
      "ALTER TABLE tenants ADD COLUMN default_vat_country VARCHAR(2) NULL",
      "ALTER TABLE tenants ADD COLUMN company_registration_number VARCHAR(100) NULL",
      "ALTER TABLE tenants ADD COLUMN company_registration_country VARCHAR(2) NULL",
      "ALTER TABLE tenants ADD COLUMN cipc_document_url VARCHAR(512) NULL",
      "ALTER TABLE invoices ADD COLUMN uuid VARCHAR(36) NULL",
      "ALTER TABLE customers ADD COLUMN customer_type VARCHAR(20) NULL DEFAULT 'company'",
      "ALTER TABLE customers ADD COLUMN phone VARCHAR(50) NULL",
      "ALTER TABLE customers ADD COLUMN contact_name VARCHAR(255) NULL",
      "ALTER TABLE customers ADD COLUMN registration_number VARCHAR(100) NULL",
      "ALTER TABLE customers ADD COLUMN vat_number VARCHAR(50) NULL",
      "ALTER TABLE customers ADD COLUMN id_number VARCHAR(50) NULL",
      "ALTER TABLE invoices ADD COLUMN discount_type VARCHAR(20) NULL",
      "ALTER TABLE invoices ADD COLUMN discount_percent DOUBLE NULL",
      "ALTER TABLE invoices ADD COLUMN discount_amount DOUBLE NULL DEFAULT 0",
    ]:
      try:
        conn.execute(text(stmt))
        conn.commit()
      except Exception:
        conn.rollback()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


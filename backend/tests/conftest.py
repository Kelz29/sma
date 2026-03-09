from typing import Generator
import os
import sys

# Use same DB as test so middleware tenant lookup sees data created in tests
os.environ["DATABASE_URI_OVERRIDE"] = "sqlite:///./test_sma.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_ROOT, ".."))
if PROJECT_ROOT not in sys.path:
  sys.path.insert(0, BACKEND_ROOT)

from app.core.config import settings  # type: ignore  # noqa: E402
from app.db.base import Base  # type: ignore  # noqa: E402
from app.db.models import accounting, tenant, user, hr, sales, feature_flag, waitlist  # type: ignore  # noqa: E402,F401
from app.api import deps  # type: ignore  # noqa: E402
from app.main import app  # type: ignore  # noqa: E402


SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sma.db"

engine = create_engine(
  SQLALCHEMY_DATABASE_URL,
  connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator:
  db = TestingSessionLocal()
  try:
    yield db
  finally:
    db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_database() -> None:
  # Ensure we are using SQLite for tests.
  settings.USE_SQLITE = True  # type: ignore[attr-defined]

  Base.metadata.drop_all(bind=engine)
  Base.metadata.create_all(bind=engine)


@pytest.fixture(scope="session")
def client(setup_database: None) -> TestClient:  # noqa: ANN001
  app.dependency_overrides[deps.get_db] = override_get_db
  with TestClient(app) as c:
    yield c


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
  """Register a tenant+user (or login if already exists) and return headers."""
  login_r = client.post(
    "/api/v1/auth/login",
    json={
      "email": "testuser@example.com",
      "password": "Password123!",
      "tenant_slug": "test-tenant",
    },
  )
  if login_r.status_code == 200:
    token = login_r.json()["access_token"]
  else:
    r = client.post(
      "/api/v1/auth/register",
      json={
        "email": "testuser@example.com",
        "password": "Password123!",
        "full_name": "Test User",
        "tenant_name": "Test Tenant",
        "tenant_slug": "test-tenant",
      },
    )
    assert r.status_code == 201
    token = r.json()["access_token"]
  return {
    "Authorization": f"Bearer {token}",
    "X-Tenant-Id": "test-tenant",
  }


@pytest.fixture
def superadmin_headers(client: TestClient) -> dict:
  """Create or reuse a superadmin user and return headers for admin endpoints."""
  from app.db.models.tenant import Tenant
  from app.db.models.user import User, TenantUser
  from app.utils.password import get_password_hash

  db = next(override_get_db())
  try:
    tenant = db.query(Tenant).filter(Tenant.slug == "super-tenant").first()
    if not tenant:
      tenant = Tenant(name="Super Tenant", slug="super-tenant")
      db.add(tenant)
      db.commit()
      db.refresh(tenant)
    user = db.query(User).filter(User.email == "superadmin@test.com").first()
    if not user:
      user = User(
        email="superadmin@test.com",
        full_name="Super Admin",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
      )
      db.add(user)
      db.commit()
      db.refresh(user)
    tu = (
      db.query(TenantUser)
      .filter(TenantUser.tenant_id == tenant.id, TenantUser.user_id == user.id)
      .first()
    )
    if not tu:
      tu = TenantUser(tenant_id=tenant.id, user_id=user.id, role="superadmin", is_owner=True)
      db.add(tu)
      db.commit()
  finally:
    db.close()

  r = client.post(
    "/api/v1/auth/login",
    json={
      "email": "superadmin@test.com",
      "password": "Password123!",
      "tenant_slug": "super-tenant",
    },
  )
  assert r.status_code == 200
  token = r.json()["access_token"]
  return {
    "Authorization": f"Bearer {token}",
    "X-Tenant-Id": "super-tenant",
  }


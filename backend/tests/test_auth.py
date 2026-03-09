from datetime import datetime, timedelta

from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
  resp = client.get("/health")
  assert resp.status_code == 200
  data = resp.json()
  assert data["status"] == "ok"
  assert data.get("db") in ("ok", "error")  # db check optional


def test_metrics_ok(client: TestClient) -> None:
  resp = client.get("/metrics")
  assert resp.status_code == 200
  data = resp.json()
  assert "requests_total" in data
  assert "errors_total" in data
  assert "uptime_seconds" in data
  assert "status_2xx" in data
  assert data["requests_total"] >= 0
  assert data["uptime_seconds"] >= 0


def test_register_and_login_flow(client: TestClient) -> None:
  # Use unique tenant so this test does not collide with auth_headers fixture
  register_payload = {
    "email": "registerflow@example.com",
    "password": "Password123!",
    "full_name": "Register Flow User",
    "tenant_name": "Register Flow Tenant",
    "tenant_slug": "register-flow-tenant",
  }
  r = client.post("/api/v1/auth/register", json=register_payload)
  assert r.status_code == 201
  token = r.json().get("access_token")
  assert isinstance(token, str) and token

  # Use login endpoint with same credentials
  login_payload = {
    "email": register_payload["email"],
    "password": register_payload["password"],
    "tenant_slug": register_payload["tenant_slug"],
  }
  r2 = client.post("/api/v1/auth/login", json=login_payload)
  assert r2.status_code == 200
  token2 = r2.json().get("access_token")
  assert isinstance(token2, str) and token2


def test_login_rejected_when_tenant_suspended(client: TestClient) -> None:
  """Login returns 403 when the tenant is suspended."""
  from app.db.models.tenant import Tenant, TenantStatus
  from app.db.models.user import User, TenantUser
  from app.utils.password import get_password_hash

  from tests.conftest import override_get_db

  db = next(override_get_db())
  try:
    tenant = Tenant(name="Suspended Co", slug="suspended-co", status=TenantStatus.suspended)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    user = User(
      email="suspendeduser@example.com",
      full_name="Suspended User",
      hashed_password=get_password_hash("Password123!"),
      is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    tu = TenantUser(tenant_id=tenant.id, user_id=user.id, role="admin", is_owner=True)
    db.add(tu)
    db.commit()
  finally:
    db.close()

  r = client.post(
    "/api/v1/auth/login",
    json={
      "email": "suspendeduser@example.com",
      "password": "Password123!",
      "tenant_slug": "suspended-co",
    },
  )
  assert r.status_code == 403
  assert "suspended" in r.json().get("detail", "").lower()


def test_verify_email_success(client: TestClient) -> None:
  """Verify email with valid token marks user as verified."""
  from app.db.models.user import EmailVerificationToken, User
  from app.utils.password import get_password_hash

  from tests.conftest import override_get_db

  db = next(override_get_db())
  try:
    user = User(
      email="verifyme@example.com",
      full_name="Verify Me",
      hashed_password=get_password_hash("Password123!"),
      is_active=True,
      email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = "test-verify-token-12345"
    ev = EmailVerificationToken(
      user_id=user.id,
      token=token,
      expires_at=datetime.utcnow() + timedelta(days=1),
    )
    db.add(ev)
    db.commit()
  finally:
    db.close()

  r = client.get("/api/v1/auth/verify-email", params={"token": token})
  assert r.status_code == 200
  assert "verified" in r.json().get("detail", "").lower()


def test_verify_email_invalid_token(client: TestClient) -> None:
  r = client.get("/api/v1/auth/verify-email", params={"token": "nonexistent-token"})
  assert r.status_code == 400
  assert "detail" in r.json()


def test_register_rejects_weak_password(client: TestClient) -> None:
  """Register with password that fails complexity returns 422."""
  r = client.post(
    "/api/v1/auth/register",
    json={
      "email": "weakpw@example.com",
      "password": "short",
      "full_name": "Weak",
      "tenant_name": "Weak Tenant",
      "tenant_slug": "weak-tenant",
    },
  )
  assert r.status_code == 422


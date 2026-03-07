from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
  resp = client.get("/health")
  assert resp.status_code == 200
  assert resp.json() == {"status": "ok"}


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


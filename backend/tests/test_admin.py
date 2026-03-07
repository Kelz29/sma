from fastapi.testclient import TestClient


def test_admin_tenants_unauthorized(client: TestClient) -> None:
  r = client.get("/api/v1/admin/tenants")
  assert r.status_code == 401


def test_admin_tenants_forbidden_for_admin(client: TestClient, auth_headers: dict) -> None:
  """Regular admin (non-superadmin) cannot list all tenants."""
  r = client.get("/api/v1/admin/tenants", headers=auth_headers)
  assert r.status_code == 403


def test_admin_tenants_success(client: TestClient, superadmin_headers: dict) -> None:
  r = client.get("/api/v1/admin/tenants", headers=superadmin_headers)
  assert r.status_code == 200
  data = r.json()
  assert isinstance(data, list)
  # At least super-tenant and possibly test-tenant from other fixtures
  names = [t["name"] for t in data]
  assert "Super Tenant" in names


def test_admin_patch_tenant_status(client: TestClient, superadmin_headers: dict) -> None:
  r = client.get("/api/v1/admin/tenants", headers=superadmin_headers)
  assert r.status_code == 200
  tenants = r.json()
  tenant_id = next(t["id"] for t in tenants if t["slug"] == "super-tenant")
  r2 = client.patch(
    f"/api/v1/admin/tenants/{tenant_id}",
    json={"status": "suspended"},
    headers=superadmin_headers,
  )
  assert r2.status_code == 200
  assert r2.json()["status"] == "suspended"
  r3 = client.patch(
    f"/api/v1/admin/tenants/{tenant_id}",
    json={"status": "active"},
    headers=superadmin_headers,
  )
  assert r3.status_code == 200
  assert r3.json()["status"] == "active"


def test_admin_tenant_users_and_reset_password(client: TestClient, superadmin_headers: dict) -> None:
  r = client.get("/api/v1/admin/tenants", headers=superadmin_headers)
  assert r.status_code == 200
  tenants = r.json()
  tenant_id = next(t["id"] for t in tenants if t["slug"] == "super-tenant")
  r2 = client.get(f"/api/v1/admin/tenants/{tenant_id}/users", headers=superadmin_headers)
  assert r2.status_code == 200
  users = r2.json()
  assert isinstance(users, list)
  if users:
    user_id = users[0]["user_id"]
    r3 = client.post(
      "/api/v1/admin/reset-password",
      json={"tenant_id": tenant_id, "user_id": user_id, "new_password": "NewPass123!"},
      headers=superadmin_headers,
    )
    assert r3.status_code == 200

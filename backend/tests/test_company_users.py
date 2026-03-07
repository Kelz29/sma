"""Tests for company users API (list, create, update, delete, and auto-employee)."""
from fastapi.testclient import TestClient


def test_company_users_unauthorized(client: TestClient) -> None:
  r = client.get("/api/v1/company/users")
  assert r.status_code == 401


def test_company_users_forbidden_for_viewer(client: TestClient) -> None:
  """Viewer cannot list or create company users; only admin can."""
  from app.db.models.tenant import Tenant
  from app.db.models.user import User, TenantUser
  from app.utils.password import get_password_hash
  from tests.conftest import override_get_db

  db = next(override_get_db())
  try:
    tenant = Tenant(name="Viewer Tenant", slug="viewer-tenant")
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    user = User(
      email="vieweronly@example.com",
      full_name="Viewer Only",
      hashed_password=get_password_hash("Password123!"),
      is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    tu = TenantUser(tenant_id=tenant.id, user_id=user.id, role="viewer", is_owner=False)
    db.add(tu)
    db.commit()
  finally:
    db.close()

  r = client.post(
    "/api/v1/auth/login",
    json={"email": "vieweronly@example.com", "password": "Password123!", "tenant_slug": "viewer-tenant"},
  )
  assert r.status_code == 200
  token = r.json()["access_token"]
  headers = {"Authorization": f"Bearer {token}", "X-Tenant-Id": "viewer-tenant"}

  r2 = client.get("/api/v1/company/users", headers=headers)
  assert r2.status_code == 403


def test_company_users_list_and_create(client: TestClient, auth_headers: dict) -> None:
  r = client.get("/api/v1/company/users", headers=auth_headers)
  assert r.status_code == 200
  data = r.json()
  assert isinstance(data, list)
  # test-tenant has at least the admin from auth_headers
  assert len(data) >= 1
  assert any(u["email"] == "testuser@example.com" for u in data)

  r2 = client.post(
    "/api/v1/company/users",
    json={
      "email": "newuser@example.com",
      "full_name": "New User",
      "password": "Password123!",
      "role": "accountant",
    },
    headers=auth_headers,
  )
  assert r2.status_code == 201
  created = r2.json()
  assert created["email"] == "newuser@example.com"
  assert created["role"] == "accountant"
  assert created["full_name"] == "New User"

  r3 = client.get("/api/v1/company/users", headers=auth_headers)
  assert r3.status_code == 200
  assert len(r3.json()) >= 2
  assert any(u["email"] == "newuser@example.com" for u in r3.json())

  # Creating a company user should auto-create an Employee for that user
  from app.db.models.hr import Employee
  from tests.conftest import override_get_db

  db = next(override_get_db())
  try:
    from app.db.models.tenant import Tenant
    from app.db.models.user import User
    tenant = db.query(Tenant).filter(Tenant.slug == "test-tenant").first()
    user = db.query(User).filter(User.email == "newuser@example.com").first()
    assert tenant and user
    emp = (
      db.query(Employee)
      .filter(Employee.tenant_id == tenant.id, Employee.user_id == user.id)
      .first()
    )
    assert emp is not None
    assert emp.first_name == "New"
    assert emp.last_name == "User"
    assert emp.employee_number == f"U{user.id}"
  finally:
    db.close()


def test_company_users_update_role_and_remove(client: TestClient, auth_headers: dict) -> None:
  # Create a user to manage
  r = client.post(
    "/api/v1/company/users",
    json={
      "email": "editme@example.com",
      "full_name": "Edit Me",
      "password": "Password123!",
      "role": "viewer",
    },
    headers=auth_headers,
  )
  assert r.status_code == 201
  created = r.json()
  tenant_user_id = created["id"]

  # Update role
  r2 = client.patch(
    f"/api/v1/company/users/{tenant_user_id}",
    json={"role": "accountant"},
    headers=auth_headers,
  )
  assert r2.status_code == 200
  assert r2.json()["role"] == "accountant"

  # Remove from company
  r3 = client.delete(f"/api/v1/company/users/{tenant_user_id}", headers=auth_headers)
  assert r3.status_code == 204

  r4 = client.get("/api/v1/company/users", headers=auth_headers)
  assert not any(u["email"] == "editme@example.com" for u in r4.json())

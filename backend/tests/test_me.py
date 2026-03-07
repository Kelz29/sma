from fastapi.testclient import TestClient


def test_me_unauthorized(client: TestClient) -> None:
  r = client.get("/api/v1/auth/me")
  assert r.status_code == 401


def test_me_success(client: TestClient, auth_headers: dict) -> None:
  r = client.get("/api/v1/auth/me", headers=auth_headers)
  assert r.status_code == 200
  data = r.json()
  assert data["email"] == "testuser@example.com"
  assert data["role"] == "admin"
  assert "tenant_id" in data

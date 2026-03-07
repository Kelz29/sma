from fastapi.testclient import TestClient


def test_accounts_list_unauthorized(client: TestClient) -> None:
  r = client.get("/api/v1/accounts/")
  assert r.status_code == 401


def test_accounts_list_empty(client: TestClient, auth_headers: dict) -> None:
  r = client.get("/api/v1/accounts/", headers=auth_headers)
  assert r.status_code == 200
  assert r.json() == []


def test_accounts_create_and_list(client: TestClient, auth_headers: dict) -> None:
  payload = {"code": "1000", "name": "Cash", "category": "asset"}
  r = client.post("/api/v1/accounts/", json=payload, headers=auth_headers)
  assert r.status_code == 201
  data = r.json()
  assert data["code"] == "1000"
  assert data["name"] == "Cash"
  assert data["category"] == "asset"

  r2 = client.get("/api/v1/accounts/", headers=auth_headers)
  assert r2.status_code == 200
  items = r2.json()
  assert len(items) == 1
  assert items[0]["id"] == data["id"]


def test_accounts_create_duplicate_code_fails(client: TestClient, auth_headers: dict) -> None:
  payload = {"code": "2000", "name": "Bank", "category": "asset"}
  client.post("/api/v1/accounts/", json=payload, headers=auth_headers)
  r2 = client.post("/api/v1/accounts/", json=payload, headers=auth_headers)
  assert r2.status_code == 400

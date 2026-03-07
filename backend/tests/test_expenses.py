from fastapi.testclient import TestClient


def test_expenses_list_unauthorized(client: TestClient) -> None:
  r = client.get("/api/v1/expenses/")
  assert r.status_code == 401


def test_expenses_list_empty(client: TestClient, auth_headers: dict) -> None:
  r = client.get("/api/v1/expenses/", headers=auth_headers)
  assert r.status_code == 200
  assert r.json() == []


def test_expenses_create_and_list(client: TestClient, auth_headers: dict) -> None:
  payload = {
    "description": "Office supplies",
    "date": "2025-03-01",
    "amount": "99.50",
    "tax_amount": "0",
    "currency": "USD",
  }
  r = client.post("/api/v1/expenses/", json=payload, headers=auth_headers)
  assert r.status_code == 201
  data = r.json()
  assert data["description"] == "Office supplies"
  assert float(data["amount"]) == 99.50

  r2 = client.get("/api/v1/expenses/", headers=auth_headers)
  assert r2.status_code == 200
  items = r2.json()
  assert len(items) == 1
  assert items[0]["id"] == data["id"]


def test_expense_categories_list(client: TestClient, auth_headers: dict) -> None:
  r = client.get("/api/v1/expenses/categories", headers=auth_headers)
  assert r.status_code == 200
  assert r.json() == []

from fastapi.testclient import TestClient


def test_banking_accounts_list_unauthorized(client: TestClient) -> None:
  r = client.get("/api/v1/banking/accounts")
  assert r.status_code == 401


def test_banking_accounts_list_empty(client: TestClient, auth_headers: dict) -> None:
  r = client.get("/api/v1/banking/accounts", headers=auth_headers)
  assert r.status_code == 200
  assert r.json() == []


def test_banking_create_account_and_list(client: TestClient, auth_headers: dict) -> None:
  payload = {
    "name": "Main Bank",
    "bank_name": "Test Bank",
    "currency": "USD",
    "opening_balance": "1000.00",
  }
  r = client.post("/api/v1/banking/accounts", json=payload, headers=auth_headers)
  assert r.status_code == 201
  data = r.json()
  assert data["name"] == "Main Bank"
  assert float(data["opening_balance"]) == 1000.0

  r2 = client.get("/api/v1/banking/accounts", headers=auth_headers)
  assert r2.status_code == 200
  items = r2.json()
  assert len(items) == 1
  assert items[0]["id"] == data["id"]

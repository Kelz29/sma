from fastapi.testclient import TestClient


def test_invoices_list_unauthorized(client: TestClient) -> None:
  r = client.get("/api/v1/invoices/")
  assert r.status_code == 401


def test_invoices_list_empty(client: TestClient, auth_headers: dict) -> None:
  r = client.get("/api/v1/invoices/", headers=auth_headers)
  assert r.status_code == 200
  assert r.json() == []


def test_invoices_create_and_list(client: TestClient, auth_headers: dict) -> None:
  payload = {
    "customer_name": "Acme Inc",
    "customer_email": "billing@acme.com",
    "issue_date": "2025-03-01",
    "due_date": "2025-03-31",
    "currency": "USD",
    "vat_rate": 20,
    "vat_country": "US",
    "notes": "Thank you",
    "is_recurring": False,
    "lines": [
      {"description": "Consulting", "quantity": 10, "unit_price": 100, "vat_rate": 20},
    ],
  }
  r = client.post("/api/v1/invoices/", json=payload, headers=auth_headers)
  assert r.status_code == 201
  data = r.json()
  assert data["customer_name"] == "Acme Inc"
  assert data["invoice_number"] == 1
  assert data["status"] == "draft"
  assert len(data["lines"]) == 1
  assert data["lines"][0]["description"] == "Consulting"

  r2 = client.get("/api/v1/invoices/", headers=auth_headers)
  assert r2.status_code == 200
  items = r2.json()
  assert len(items) == 1
  assert items[0]["id"] == data["id"]
  # API may return decimal as number or string
  total = items[0]["total"]
  assert float(total) == 1200.0  # 10 * 100 * 1.2


def test_invoices_get_by_id(client: TestClient, auth_headers: dict) -> None:
  # Create then fetch by id
  payload = {
    "customer_name": "Get Test Inc",
    "issue_date": "2025-03-01",
    "currency": "USD",
    "lines": [{"description": "Item", "quantity": 1, "unit_price": 50}],
  }
  r = client.post("/api/v1/invoices/", json=payload, headers=auth_headers)
  assert r.status_code == 201
  inv_id = r.json()["id"]
  r2 = client.get(f"/api/v1/invoices/{inv_id}", headers=auth_headers)
  assert r2.status_code == 200
  assert r2.json()["customer_name"] == "Get Test Inc"
  assert r2.json()["id"] == inv_id


def test_invoices_create_validation_fails(client: TestClient, auth_headers: dict) -> None:
  # Invalid issue_date type and missing required fields to trigger 422
  r = client.post(
    "/api/v1/invoices/",
    json={
      "customer_name": "Acme",
      "issue_date": "not-a-date",
      "currency": "USD",
      "lines": [{"description": "x", "quantity": 1, "unit_price": 10}],
    },
    headers=auth_headers,
  )
  assert r.status_code == 422

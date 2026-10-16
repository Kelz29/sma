from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.db.models.tenant import Tenant
from app.db.models.usage import UsageEvent
from app.db.session import SessionLocal
from app.main import app


def _telemetry_boom():
  raise RuntimeError("boom")


app.add_api_route("/api/v1/_telemetry_boom", _telemetry_boom, methods=["POST"])


def test_signed_in_user_records_page_view(client: TestClient, auth_headers: dict, superadmin_headers: dict) -> None:
  recorded = client.post(
    "/api/v1/telemetry/events",
    json={"kind": "page_view", "path": "/invoices?customer=secret"},
    headers=auth_headers,
  )
  assert recorded.status_code == 204
  listed = client.get("/api/v1/admin/telemetry/events", headers=superadmin_headers)
  assert listed.status_code == 200
  paths = [event["path"] for event in listed.json()]
  assert "/invoices" in paths
  assert all("secret" not in event["path"] for event in listed.json())


def test_admin_cannot_read_usage_summary(client: TestClient, auth_headers: dict) -> None:
  response = client.get("/api/v1/admin/telemetry/summary", headers=auth_headers)
  assert response.status_code == 403


def test_summary_ranks_used_features_and_flags_errors(
  client: TestClient,
  auth_headers: dict,
  superadmin_headers: dict,
) -> None:
  db = SessionLocal()
  try:
    business = db.query(Tenant).filter(Tenant.slug == "test-tenant").one()
    other = db.query(Tenant).filter(Tenant.slug == "super-tenant").one()
    now = datetime.utcnow()
    yesterday = now - timedelta(days=1)
    rows = [
      UsageEvent(kind="page_view", path="/invoices", tenant_id=business.id, role="admin", created_at=yesterday),
      UsageEvent(kind="page_view", path="/invoices", tenant_id=business.id, role="admin", created_at=now),
      UsageEvent(
        kind="action",
        path="/api/v1/invoices",
        action="invoice_created",
        tenant_id=business.id,
        role="admin",
        created_at=now,
      ),
      UsageEvent(kind="page_view", path="/dashboard", tenant_id=other.id, role="superadmin", created_at=now),
    ]
    for _ in range(8):
      rows.append(UsageEvent(kind="page_view", path="/expenses", tenant_id=business.id, role="admin", created_at=now))
      rows.append(
        UsageEvent(
          kind="api_error",
          path="/api/v1/expenses",
          method="POST",
          status_code=500,
          tenant_id=business.id,
          role="admin",
          created_at=now,
        )
      )
    db.add_all(rows)
    db.commit()
  finally:
    db.close()

  response = client.get("/api/v1/admin/telemetry/summary", headers=superadmin_headers)
  assert response.status_code == 200
  features = {item["key"]: item for item in response.json()["features"]}
  assert features["invoices"]["score"] > features["banking"]["score"]
  assert features["expenses"]["label_kind"] == "fix_first"


def test_api_error_records_path_and_status_without_body(auth_headers: dict) -> None:
  with TestClient(app, raise_server_exceptions=False) as boom_client:
    response = boom_client.post(
      "/api/v1/_telemetry_boom",
      json={"customer_name": "SECRET_CUSTOMER_BODY"},
      headers=auth_headers,
    )
  assert response.status_code == 500
  db = SessionLocal()
  try:
    rows = (
      db.query(UsageEvent)
      .filter(UsageEvent.kind == "api_error", UsageEvent.path == "/api/v1/_telemetry_boom")
      .all()
    )
  finally:
    db.close()
  assert rows
  row = rows[-1]
  assert row.status_code == 500
  assert row.method == "POST"
  blob = " ".join(part or "" for part in (row.message, row.stack, row.path, row.action))
  assert "SECRET_CUSTOMER_BODY" not in blob

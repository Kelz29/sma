"""CORS must allow https://app.smartseen.co.za (credentialed) and reject other origins.

Regression guard: the frontend is served from app.smartseen.co.za with
withCredentials, so a missing/refused ACAO header surfaces in the browser as an
opaque "CORS error" on login even when the API itself is healthy.
"""
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

APP_ORIGIN = "https://app.smartseen.co.za"


def test_preflight_login_from_app_origin():
  r = client.options(
    "/api/v1/auth/login",
    headers={
      "Origin": APP_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization,x-tenant-id,ngrok-skip-browser-warning",
    },
  )
  assert r.status_code == 200
  assert r.headers.get("access-control-allow-origin") == APP_ORIGIN
  assert r.headers.get("access-control-allow-credentials") == "true"


def test_login_response_carries_acao_for_app_origin():
  r = client.post(
    "/api/v1/auth/login",
    headers={"Origin": APP_ORIGIN},
    json={"email": "nobody@example.com", "password": "wrong", "tenant_slug": "nope"},
  )
  assert r.status_code in (400, 401, 403, 404, 422)
  assert r.headers.get("access-control-allow-origin") == APP_ORIGIN


@pytest.mark.skipif(
  settings.CORS_ORIGINS.strip() == "*",
  reason="CORS_ORIGINS=* (dev wildcard) reflects any origin by design",
)
def test_preflight_from_foreign_origin_not_allowed():
  r = client.options(
    "/api/v1/auth/login",
    headers={
      "Origin": "https://evil.example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  )
  assert r.headers.get("access-control-allow-origin") != "https://evil.example.com"

"""Feature flags API: public read for any authenticated user; admin list/patch for superadmin only."""

from fastapi.testclient import TestClient


def test_feature_flags_list_unauthorized(client: TestClient) -> None:
    """GET /feature-flags requires authentication."""
    r = client.get("/api/v1/feature-flags")
    assert r.status_code == 401


def test_feature_flags_list_success(client: TestClient, auth_headers: dict) -> None:
    """Any authenticated user can read feature flags."""
    r = client.get("/api/v1/feature-flags", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    keys = [f["key"] for f in data]
    assert "dashboard" in keys
    assert "invoices" in keys
    assert "leads" in keys


def test_admin_feature_flags_unauthorized(client: TestClient) -> None:
    """GET /admin/feature-flags requires auth."""
    r = client.get("/api/v1/admin/feature-flags")
    assert r.status_code == 401


def test_admin_feature_flags_forbidden_for_admin(client: TestClient, auth_headers: dict) -> None:
    """Only superadmin can list admin feature flags."""
    r = client.get("/api/v1/admin/feature-flags", headers=auth_headers)
    assert r.status_code == 403


def test_admin_feature_flags_success(client: TestClient, superadmin_headers: dict) -> None:
    """Superadmin can list and patch feature flags."""
    r = client.get("/api/v1/admin/feature-flags", headers=superadmin_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    invoices = next(f for f in data if f["key"] == "invoices")
    assert "enabled" in invoices

    r2 = client.patch(
        "/api/v1/admin/feature-flags/invoices",
        json={"enabled": False},
        headers=superadmin_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["enabled"] is False

    r3 = client.patch(
        "/api/v1/admin/feature-flags/invoices",
        json={"enabled": True},
        headers=superadmin_headers,
    )
    assert r3.status_code == 200
    assert r3.json()["enabled"] is True


def test_admin_feature_flags_patch_forbidden_for_admin(client: TestClient, auth_headers: dict) -> None:
    """Only superadmin can patch feature flags."""
    r = client.patch(
        "/api/v1/admin/feature-flags/invoices",
        json={"enabled": False},
        headers=auth_headers,
    )
    assert r.status_code == 403


def test_admin_feature_flags_patch_unknown_key(client: TestClient, superadmin_headers: dict) -> None:
    """Patching an unknown key returns 404."""
    r = client.patch(
        "/api/v1/admin/feature-flags/nonexistent",
        json={"enabled": False},
        headers=superadmin_headers,
    )
    assert r.status_code == 404

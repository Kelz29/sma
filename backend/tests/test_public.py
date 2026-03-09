"""Tests for public API: landing (slots), waitlist."""
from fastapi.testclient import TestClient


def test_landing_returns_slots(client: TestClient) -> None:
  r = client.get("/api/v1/landing")
  assert r.status_code == 200
  data = r.json()
  assert "slots_left" in data
  assert "total_slots" in data
  assert "registration_open" in data
  assert isinstance(data["slots_left"], int)
  assert isinstance(data["total_slots"], int)
  assert isinstance(data["registration_open"], bool)
  assert data["slots_left"] >= 0
  assert data["total_slots"] > 0


def test_waitlist_accepts_email(client: TestClient) -> None:
  r = client.post("/api/v1/waitlist", json={"email": "waitlist-test@example.com"})
  assert r.status_code == 200
  data = r.json()
  assert "message" in data
  assert "list" in data["message"].lower() or "contact" in data["message"].lower()


def test_waitlist_idempotent_same_email(client: TestClient) -> None:
  email = "idempotent-waitlist@example.com"
  r1 = client.post("/api/v1/waitlist", json={"email": email})
  assert r1.status_code == 200
  r2 = client.post("/api/v1/waitlist", json={"email": email})
  assert r2.status_code == 200
  # Second time may say "already on the list"
  assert "message" in r2.json()


def test_waitlist_rejects_invalid_email(client: TestClient) -> None:
  r = client.post("/api/v1/waitlist", json={"email": "not-an-email"})
  assert r.status_code == 422

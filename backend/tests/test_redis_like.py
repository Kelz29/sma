"""Tests for our in-memory Redis-like store (app.core.redis_like)."""
import time

import pytest

from app.core import redis_like


@pytest.fixture(autouse=True)
def clear_store():
  redis_like.clear()
  yield
  redis_like.clear()


def test_get_set():
  assert redis_like.get("k1") is None
  redis_like.set("k1", "v1")
  assert redis_like.get("k1") == "v1"
  redis_like.set("k1", "v2")
  assert redis_like.get("k1") == "v2"


def test_set_with_ttl_expires():
  redis_like.set("k", "v", ttl_seconds=1)
  assert redis_like.get("k") == "v"
  time.sleep(1.1)
  assert redis_like.get("k") is None


def test_setex():
  redis_like.setex("k", 1, "v")
  assert redis_like.get("k") == "v"
  time.sleep(1.1)
  assert redis_like.get("k") is None


def test_incr():
  assert redis_like.incr("c") == 1
  assert redis_like.incr("c") == 2
  assert redis_like.incr("c") == 3
  assert redis_like.get("c") == "3"


def test_incr_with_ttl():
  redis_like.incr("c", ttl_seconds=1)
  assert redis_like.get("c") == "1"
  time.sleep(1.1)
  assert redis_like.incr("c") == 1


def test_incrby():
  assert redis_like.incrby("c", 5) == 5
  assert redis_like.incrby("c", 3) == 8
  assert redis_like.incrby("c") == 9


def test_delete():
  redis_like.set("k", "v")
  assert redis_like.delete("k") is True
  assert redis_like.get("k") is None
  assert redis_like.delete("k") is False


def test_exists():
  assert redis_like.exists("k") == 0
  redis_like.set("k", "v")
  assert redis_like.exists("k") == 1
  redis_like.delete("k")
  assert redis_like.exists("k") == 0


def test_exists_expired():
  redis_like.set("k", "v", ttl_seconds=1)
  assert redis_like.exists("k") == 1
  time.sleep(1.1)
  assert redis_like.exists("k") == 0


def test_expire():
  redis_like.set("k", "v")
  assert redis_like.expire("k", 1) is True
  assert redis_like.get("k") == "v"
  time.sleep(1.1)
  assert redis_like.get("k") is None
  assert redis_like.expire("missing", 10) is False


def test_ttl():
  assert redis_like.ttl("missing") == -2
  redis_like.set("k", "v")
  assert redis_like.ttl("k") == -1
  redis_like.set("k", "v", ttl_seconds=10)
  t = redis_like.ttl("k")
  assert 0 <= t <= 10
  time.sleep(0.5)
  t2 = redis_like.ttl("k")
  assert 0 <= t2 <= t


def test_mget():
  redis_like.set("a", "1")
  redis_like.set("c", "3")
  assert redis_like.mget(["a", "b", "c"]) == ["1", None, "3"]


def test_clear():
  redis_like.set("a", "1")
  redis_like.set("b", "2")
  redis_like.clear()
  assert redis_like.get("a") is None
  assert redis_like.get("b") is None
  assert redis_like.dbsize() == 0


def test_dbsize():
  assert redis_like.dbsize() == 0
  redis_like.set("a", "1")
  redis_like.set("b", "2")
  assert redis_like.dbsize() == 2
  redis_like.delete("a")
  assert redis_like.dbsize() == 1

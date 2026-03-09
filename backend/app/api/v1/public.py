"""
Public, unauthenticated endpoints for the marketing landing page:
- Slots left for free business registration (first N businesses).
- Waitlist signup when slots are full.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.redis_client import cache_get, cache_set
from app.db.models.tenant import Tenant
from app.db.models.waitlist import WaitlistEntry

_LANDING_CACHE_KEY = "landing:slots"
_LANDING_CACHE_TTL = 30  # seconds

router = APIRouter(tags=["public"])


class LandingResponse(BaseModel):
  slots_left: int
  total_slots: int
  registration_open: bool


class WaitlistRequest(BaseModel):
  email: EmailStr


class WaitlistResponse(BaseModel):
  message: str


@router.get("/landing", response_model=LandingResponse)
def get_landing(db: Session = Depends(get_db)):
  """
  Return how many free business slots remain and whether registration is open.
  Used by the landing page to show the promo counter or the waitlist form.
  Cached in Redis for 30s when REDIS_URL is set.
  """
  cached = cache_get(_LANDING_CACHE_KEY)
  if cached is not None and isinstance(cached, dict):
    return LandingResponse(**cached)
  total_slots = settings.FREE_BUSINESS_SLOTS
  count = db.query(Tenant).count()
  slots_left = max(0, total_slots - count)
  data = {
    "slots_left": slots_left,
    "total_slots": total_slots,
    "registration_open": slots_left > 0,
  }
  cache_set(_LANDING_CACHE_KEY, data, ttl_seconds=_LANDING_CACHE_TTL)
  return LandingResponse(**data)


@router.post("/waitlist", response_model=WaitlistResponse)
def join_waitlist(payload: WaitlistRequest, db: Session = Depends(get_db)):
  """
  Add an email to the waitlist. Idempotent: same email can submit again (no duplicate error).
  """
  email = payload.email.strip().lower()
  existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == email).first()
  if existing:
    return WaitlistResponse(message="You're already on the list. We'll be in touch when a spot opens.")
  entry = WaitlistEntry(email=email)
  db.add(entry)
  db.commit()
  return WaitlistResponse(message="You're on the list. We'll contact you when SmartSeen can welcome you onboard.")

"""Pydantic schemas for sales module."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, constr


# ----- Leads -----
class LeadBase(BaseModel):
  name: constr(strip_whitespace=True, max_length=255)
  email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  company: Optional[constr(strip_whitespace=True, max_length=255)] = None
  phone: Optional[constr(strip_whitespace=True, max_length=50)] = None
  source: Optional[constr(strip_whitespace=True, max_length=100)] = None
  status: Optional[constr(strip_whitespace=True, max_length=50)] = "new"
  estimated_value: Optional[float] = None
  notes: Optional[str] = None


class LeadCreate(LeadBase):
  pass


class LeadUpdate(BaseModel):
  name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  email: Optional[constr(strip_whitespace=True, max_length=255)] = None
  company: Optional[constr(strip_whitespace=True, max_length=255)] = None
  phone: Optional[constr(strip_whitespace=True, max_length=50)] = None
  source: Optional[constr(strip_whitespace=True, max_length=100)] = None
  status: Optional[constr(strip_whitespace=True, max_length=50)] = None
  estimated_value: Optional[float] = None
  notes: Optional[str] = None


class LeadRead(LeadBase):
  id: int
  created_at: datetime
  updated_at: datetime

  class Config:
    from_attributes = True


# ----- Proposals -----
class ProposalBase(BaseModel):
  lead_id: Optional[int] = None
  title: constr(strip_whitespace=True, max_length=255)
  status: Optional[constr(strip_whitespace=True, max_length=50)] = "draft"
  value: Optional[float] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = "ZAR"
  notes: Optional[str] = None


class ProposalCreate(ProposalBase):
  pass


class ProposalUpdate(BaseModel):
  lead_id: Optional[int] = None
  title: Optional[constr(strip_whitespace=True, max_length=255)] = None
  status: Optional[constr(strip_whitespace=True, max_length=50)] = None
  value: Optional[float] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = None
  notes: Optional[str] = None


class ProposalRead(ProposalBase):
  id: int
  sent_at: Optional[datetime] = None
  accepted_at: Optional[datetime] = None
  created_at: datetime
  updated_at: datetime

  class Config:
    from_attributes = True


# ----- Contracts -----
class ContractBase(BaseModel):
  proposal_id: Optional[int] = None
  lead_id: Optional[int] = None
  title: constr(strip_whitespace=True, max_length=255)
  party_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  start_date: Optional[date] = None
  end_date: Optional[date] = None
  value: Optional[float] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = "ZAR"
  document_url: Optional[constr(strip_whitespace=True, max_length=500)] = None
  status: Optional[constr(strip_whitespace=True, max_length=50)] = "draft"
  notes: Optional[str] = None


class ContractCreate(ContractBase):
  pass


class ContractUpdate(BaseModel):
  proposal_id: Optional[int] = None
  lead_id: Optional[int] = None
  title: Optional[constr(strip_whitespace=True, max_length=255)] = None
  party_name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  start_date: Optional[date] = None
  end_date: Optional[date] = None
  value: Optional[float] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = None
  document_url: Optional[constr(strip_whitespace=True, max_length=500)] = None
  status: Optional[constr(strip_whitespace=True, max_length=50)] = None
  notes: Optional[str] = None


class ContractRead(ContractBase):
  id: int
  created_at: datetime
  updated_at: datetime

  class Config:
    from_attributes = True


# ----- Pitch decks -----
class PitchDeckBase(BaseModel):
  lead_id: Optional[int] = None
  deal_id: Optional[int] = None
  title: constr(strip_whitespace=True, max_length=255)
  file_url: Optional[constr(strip_whitespace=True, max_length=500)] = None
  notes: Optional[str] = None


class PitchDeckCreate(PitchDeckBase):
  pass


class PitchDeckUpdate(BaseModel):
  lead_id: Optional[int] = None
  deal_id: Optional[int] = None
  title: Optional[constr(strip_whitespace=True, max_length=255)] = None
  file_url: Optional[constr(strip_whitespace=True, max_length=500)] = None
  notes: Optional[str] = None


class PitchDeckRead(PitchDeckBase):
  id: int
  created_at: datetime
  updated_at: datetime

  class Config:
    from_attributes = True


# ----- Deals (pipeline) -----
class DealBase(BaseModel):
  lead_id: Optional[int] = None
  name: constr(strip_whitespace=True, max_length=255)
  stage: Optional[constr(strip_whitespace=True, max_length=50)] = "qualified"
  value: Optional[float] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = "ZAR"
  expected_close_date: Optional[date] = None
  notes: Optional[str] = None


class DealCreate(DealBase):
  pass


class DealUpdate(BaseModel):
  lead_id: Optional[int] = None
  name: Optional[constr(strip_whitespace=True, max_length=255)] = None
  stage: Optional[constr(strip_whitespace=True, max_length=50)] = None
  value: Optional[float] = None
  currency: Optional[constr(strip_whitespace=True, max_length=3)] = None
  expected_close_date: Optional[date] = None
  notes: Optional[str] = None


class DealRead(DealBase):
  id: int
  created_at: datetime
  updated_at: datetime

  class Config:
    from_attributes = True

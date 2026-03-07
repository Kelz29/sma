"""Sales API: leads, proposals, contracts, pitch decks, pipeline (deals)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.sales import Lead, Proposal, Contract, PitchDeck, Deal
from app.middleware.tenant_context import get_current_tenant_id
from app.schemas.sales import (
  LeadCreate,
  LeadRead,
  LeadUpdate,
  ProposalCreate,
  ProposalRead,
  ProposalUpdate,
  ContractCreate,
  ContractRead,
  ContractUpdate,
  PitchDeckCreate,
  PitchDeckRead,
  PitchDeckUpdate,
  DealCreate,
  DealRead,
  DealUpdate,
)

router = APIRouter(prefix="/sales", tags=["sales"])


def _tenant_id():
  tid = get_current_tenant_id()
  if not tid:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant not resolved")
  return tid


# ----- Leads -----
@router.get("/leads", response_model=list[LeadRead])
def list_leads(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  return (
    db.query(Lead)
    .filter(Lead.tenant_id == tenant_id)
    .order_by(Lead.updated_at.desc())
    .all()
  )


@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(
  payload: LeadCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  lead = Lead(tenant_id=tenant_id, **payload.model_dump())
  db.add(lead)
  db.commit()
  db.refresh(lead)
  return lead


@router.get("/leads/{lead_id}", response_model=LeadRead)
def get_lead(
  lead_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  lead = db.query(Lead).filter(Lead.tenant_id == tenant_id, Lead.id == lead_id).first()
  if not lead:
    raise HTTPException(status_code=404, detail="Lead not found")
  return lead


@router.put("/leads/{lead_id}", response_model=LeadRead)
def update_lead(
  lead_id: int,
  payload: LeadUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  lead = db.query(Lead).filter(Lead.tenant_id == tenant_id, Lead.id == lead_id).first()
  if not lead:
    raise HTTPException(status_code=404, detail="Lead not found")
  for k, v in payload.model_dump(exclude_unset=True).items():
    setattr(lead, k, v)
  db.add(lead)
  db.commit()
  db.refresh(lead)
  return lead


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
  lead_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  lead = db.query(Lead).filter(Lead.tenant_id == tenant_id, Lead.id == lead_id).first()
  if not lead:
    raise HTTPException(status_code=404, detail="Lead not found")
  db.delete(lead)
  db.commit()
  return None


# ----- Proposals -----
@router.get("/proposals", response_model=list[ProposalRead])
def list_proposals(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  return (
    db.query(Proposal)
    .filter(Proposal.tenant_id == tenant_id)
    .order_by(Proposal.updated_at.desc())
    .all()
  )


@router.post("/proposals", response_model=ProposalRead, status_code=status.HTTP_201_CREATED)
def create_proposal(
  payload: ProposalCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  proposal = Proposal(tenant_id=tenant_id, **payload.model_dump())
  db.add(proposal)
  db.commit()
  db.refresh(proposal)
  return proposal


@router.get("/proposals/{proposal_id}", response_model=ProposalRead)
def get_proposal(
  proposal_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  proposal = db.query(Proposal).filter(Proposal.tenant_id == tenant_id, Proposal.id == proposal_id).first()
  if not proposal:
    raise HTTPException(status_code=404, detail="Proposal not found")
  return proposal


@router.put("/proposals/{proposal_id}", response_model=ProposalRead)
def update_proposal(
  proposal_id: int,
  payload: ProposalUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  proposal = db.query(Proposal).filter(Proposal.tenant_id == tenant_id, Proposal.id == proposal_id).first()
  if not proposal:
    raise HTTPException(status_code=404, detail="Proposal not found")
  for k, v in payload.model_dump(exclude_unset=True).items():
    setattr(proposal, k, v)
  db.add(proposal)
  db.commit()
  db.refresh(proposal)
  return proposal


@router.delete("/proposals/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_proposal(
  proposal_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  proposal = db.query(Proposal).filter(Proposal.tenant_id == tenant_id, Proposal.id == proposal_id).first()
  if not proposal:
    raise HTTPException(status_code=404, detail="Proposal not found")
  db.delete(proposal)
  db.commit()
  return None


# ----- Contracts -----
@router.get("/contracts", response_model=list[ContractRead])
def list_contracts(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  return (
    db.query(Contract)
    .filter(Contract.tenant_id == tenant_id)
    .order_by(Contract.updated_at.desc())
    .all()
  )


@router.post("/contracts", response_model=ContractRead, status_code=status.HTTP_201_CREATED)
def create_contract(
  payload: ContractCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  contract = Contract(tenant_id=tenant_id, **payload.model_dump())
  db.add(contract)
  db.commit()
  db.refresh(contract)
  return contract


@router.get("/contracts/{contract_id}", response_model=ContractRead)
def get_contract(
  contract_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  contract = db.query(Contract).filter(Contract.tenant_id == tenant_id, Contract.id == contract_id).first()
  if not contract:
    raise HTTPException(status_code=404, detail="Contract not found")
  return contract


@router.put("/contracts/{contract_id}", response_model=ContractRead)
def update_contract(
  contract_id: int,
  payload: ContractUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  contract = db.query(Contract).filter(Contract.tenant_id == tenant_id, Contract.id == contract_id).first()
  if not contract:
    raise HTTPException(status_code=404, detail="Contract not found")
  for k, v in payload.model_dump(exclude_unset=True).items():
    setattr(contract, k, v)
  db.add(contract)
  db.commit()
  db.refresh(contract)
  return contract


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(
  contract_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  contract = db.query(Contract).filter(Contract.tenant_id == tenant_id, Contract.id == contract_id).first()
  if not contract:
    raise HTTPException(status_code=404, detail="Contract not found")
  db.delete(contract)
  db.commit()
  return None


# ----- Pitch decks -----
@router.get("/pitch-decks", response_model=list[PitchDeckRead])
def list_pitch_decks(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  return (
    db.query(PitchDeck)
    .filter(PitchDeck.tenant_id == tenant_id)
    .order_by(PitchDeck.updated_at.desc())
    .all()
  )


@router.post("/pitch-decks", response_model=PitchDeckRead, status_code=status.HTTP_201_CREATED)
def create_pitch_deck(
  payload: PitchDeckCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deck = PitchDeck(tenant_id=tenant_id, **payload.model_dump())
  db.add(deck)
  db.commit()
  db.refresh(deck)
  return deck


@router.get("/pitch-decks/{deck_id}", response_model=PitchDeckRead)
def get_pitch_deck(
  deck_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deck = db.query(PitchDeck).filter(PitchDeck.tenant_id == tenant_id, PitchDeck.id == deck_id).first()
  if not deck:
    raise HTTPException(status_code=404, detail="Pitch deck not found")
  return deck


@router.put("/pitch-decks/{deck_id}", response_model=PitchDeckRead)
def update_pitch_deck(
  deck_id: int,
  payload: PitchDeckUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deck = db.query(PitchDeck).filter(PitchDeck.tenant_id == tenant_id, PitchDeck.id == deck_id).first()
  if not deck:
    raise HTTPException(status_code=404, detail="Pitch deck not found")
  for k, v in payload.model_dump(exclude_unset=True).items():
    setattr(deck, k, v)
  db.add(deck)
  db.commit()
  db.refresh(deck)
  return deck


@router.delete("/pitch-decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pitch_deck(
  deck_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deck = db.query(PitchDeck).filter(PitchDeck.tenant_id == tenant_id, PitchDeck.id == deck_id).first()
  if not deck:
    raise HTTPException(status_code=404, detail="Pitch deck not found")
  db.delete(deck)
  db.commit()
  return None


# ----- Pipeline (deals) -----
@router.get("/pipeline", response_model=list[DealRead])
def list_deals(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  return (
    db.query(Deal)
    .filter(Deal.tenant_id == tenant_id)
    .order_by(Deal.expected_close_date.asc().nulls_last(), Deal.updated_at.desc())
    .all()
  )


@router.post("/pipeline", response_model=DealRead, status_code=status.HTTP_201_CREATED)
def create_deal(
  payload: DealCreate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deal = Deal(tenant_id=tenant_id, **payload.model_dump())
  db.add(deal)
  db.commit()
  db.refresh(deal)
  return deal


@router.get("/pipeline/{deal_id}", response_model=DealRead)
def get_deal(
  deal_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deal = db.query(Deal).filter(Deal.tenant_id == tenant_id, Deal.id == deal_id).first()
  if not deal:
    raise HTTPException(status_code=404, detail="Deal not found")
  return deal


@router.put("/pipeline/{deal_id}", response_model=DealRead)
def update_deal(
  deal_id: int,
  payload: DealUpdate,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deal = db.query(Deal).filter(Deal.tenant_id == tenant_id, Deal.id == deal_id).first()
  if not deal:
    raise HTTPException(status_code=404, detail="Deal not found")
  for k, v in payload.model_dump(exclude_unset=True).items():
    setattr(deal, k, v)
  db.add(deal)
  db.commit()
  db.refresh(deal)
  return deal


@router.delete("/pipeline/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(
  deal_id: int,
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.require_role(["admin", "sales", "superadmin"])),
):
  tenant_id = _tenant_id()
  deal = db.query(Deal).filter(Deal.tenant_id == tenant_id, Deal.id == deal_id).first()
  if not deal:
    raise HTTPException(status_code=404, detail="Deal not found")
  db.delete(deal)
  db.commit()
  return None

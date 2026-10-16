from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TelemetryEventCreate(BaseModel):
  kind: Literal["page_view", "client_error", "action"]
  path: str = Field(min_length=1, max_length=255)
  action: str | None = None
  message: str | None = None
  stack: str | None = None


class FeatureInsight(BaseModel):
  key: str
  label: str
  adoption: float
  frequency: float
  return_lift: float
  error_rate: float
  score: float
  label_kind: str


class FunnelStep(BaseModel):
  key: str
  label: str
  tenants: int


class DailyActive(BaseModel):
  date: str
  active_tenants: int


class TenantUsage(BaseModel):
  tenant_id: int
  tenant_name: str
  last_seen: datetime
  features: list[str]
  error_count: int


class UsageSummary(BaseModel):
  days: int
  active_tenants: int
  error_count: int
  focus: list[str]
  features: list[FeatureInsight]
  funnel: list[FunnelStep]
  daily: list[DailyActive]
  tenants: list[TenantUsage]


class UsageEventRead(BaseModel):
  id: int
  kind: str
  path: str
  action: str | None = None
  method: str | None = None
  status_code: int | None = None
  message: str | None = None
  user_id: int | None = None
  user_email: str | None = None
  tenant_id: int | None = None
  tenant_name: str | None = None
  role: str | None = None
  created_at: datetime

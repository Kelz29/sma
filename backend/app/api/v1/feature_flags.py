from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models.feature_flag import FEATURE_KEYS, FeatureFlag, ensure_defaults
from app.schemas.admin import FeatureFlagRead

router = APIRouter(tags=["feature-flags"])


@router.get("/feature-flags", response_model=list[FeatureFlagRead])
def list_feature_flags(
  db: Session = Depends(deps.get_db),
  ctx=Depends(deps.get_current_user),
):
  """
  List enabled/disabled state of all platform features.
  Any authenticated user can call this; frontend uses it to show/hide nav and guard routes.
  """
  ensure_defaults(db)
  rows = db.query(FeatureFlag).filter(FeatureFlag.key.in_(FEATURE_KEYS)).order_by(FeatureFlag.key).all()
  return rows

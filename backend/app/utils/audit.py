from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.db.models.accounting import AuditLog
from app.middleware.request_context import get_request_ip


def _compute_hash(payload: dict[str, Any]) -> str:
  data = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
  return hashlib.sha256(data).hexdigest()


def log_audit(
  db: Session,
  *,
  tenant_id: Optional[int],
  user_id: Optional[int],
  action: str,
  entity_type: str,
  entity_id: Optional[str] = None,
  details: Optional[str] = None,
  old_values: Optional[dict[str, Any]] = None,
  new_values: Optional[dict[str, Any]] = None,
) -> None:
  """
  Append-only audit record with hash chaining for tamper-evidence.
  """
  ip_address = get_request_ip()

  # Get previous hash for simple hash-chain
  last = db.query(AuditLog.hash).order_by(AuditLog.id.desc()).first()
  prev_hash = last[0] if last and last[0] else None

  created_at = datetime.now(timezone.utc)

  payload = {
    "tenant_id": tenant_id,
    "user_id": user_id,
    "action": action,
    "entity_type": entity_type,
    "entity_id": entity_id,
    "details": details,
    "ip_address": ip_address,
    "old_values": old_values,
    "new_values": new_values,
    "created_at": created_at.isoformat(),
    "prev_hash": prev_hash,
  }
  current_hash = _compute_hash(payload)

  entry = AuditLog(
    tenant_id=tenant_id,
    user_id=user_id,
    action=action,
    entity_type=entity_type,
    entity_id=entity_id,
    details=details,
    ip_address=ip_address,
    old_values=json.dumps(old_values, separators=(",", ":"), sort_keys=True) if old_values else None,
    new_values=json.dumps(new_values, separators=(",", ":"), sort_keys=True) if new_values else None,
    prev_hash=prev_hash,
    hash=current_hash,
    created_at=created_at,
  )
  db.add(entry)
  db.flush()


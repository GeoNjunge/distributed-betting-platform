from datetime import datetime, timezone
from hashlib import sha256


def timestamp_to_epoch_ms(timestamp: datetime) -> int:
    return int(timestamp.astimezone(timezone.utc).timestamp() * 1000)


def generate_idempotency_key(user_id: str, match_id: str, timestamp: datetime) -> str:
    """Deterministically hash the required tuple: user_id + match_id + timestamp."""
    epoch_ms = timestamp_to_epoch_ms(timestamp)
    canonical = f"{user_id}:{match_id}:{epoch_ms}"
    return sha256(canonical.encode("utf-8")).hexdigest()

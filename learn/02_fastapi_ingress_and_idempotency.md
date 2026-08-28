# 02 — FastAPI Ingress and Idempotency

## Goal

Build the HTTP boundary that authenticates users, validates bet requests, creates deterministic idempotency keys, and publishes events to Kafka.

The service must not directly mutate bet or wallet tables.

## Stage 1: Define the Request Schema

```python
class BetCreateRequest(BaseModel):
    match_id: str = Field(min_length=1, max_length=128)
    market_id: str = Field(min_length=1, max_length=128)
    selection_id: str = Field(min_length=1, max_length=128)
    stake: Decimal = Field(gt=Decimal("0"), max_digits=18, decimal_places=2)
    potential_payout: Decimal = Field(gt=Decimal("0"), max_digits=18, decimal_places=2)
    timestamp: datetime
```

### Why Pydantic at the Boundary?

HTTP is untrusted. Pydantic turns untrusted bytes into typed data or rejects them.

Do validation before Kafka publish. Kafka topics should not become garbage queues.

## Stage 2: Fixed-Point Currency Conversion

```python
def decimal_money_to_cents(value: Decimal) -> int:
    cents = (value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(cents)
```

Parameter explanation:

- `value`: decimal dollar amount.
- multiply by `100`: convert dollars to cents.
- `quantize(Decimal("1"))`: force integer cent precision.
- `ROUND_HALF_UP`: predictable financial rounding mode.

Avoid:

```python
int(float_value * 100)
```

Binary floating-point can produce `999` instead of `1000` for some inputs.

## Stage 3: Register and Login

Auth returns an HttpOnly cookie:

```python
response.set_cookie(
    key=settings.auth_cookie_name,
    value=token,
    httponly=True,
    secure=settings.cookie_secure,
    samesite=settings.cookie_samesite,
    max_age=settings.access_token_expire_minutes * 60,
)
```

### Parameter Meaning

| Parameter | Purpose |
|---|---|
| `httponly=True` | JavaScript cannot read the token. |
| `secure=True` | Browser sends cookie only over HTTPS. |
| `samesite='lax'` | Reduces CSRF exposure for cross-site requests. |
| `max_age` | Cookie lifetime in seconds. |

For local HTTP development, set `COOKIE_SECURE=false`.

## Stage 4: Authenticate Bet Requests

```python
def current_user_from_request(request: Request) -> UserRecord:
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="missing authentication cookie")
    claims = decode_access_token(token)
    ...
```

The bet endpoint depends on this function:

```python
async def submit_bet(
    payload: BetCreateRequest,
    user: UserRecord = Depends(current_user_from_request),
    publisher: KafkaPublisher = Depends(get_kafka_publisher),
) -> BetAcceptedResponse:
```

FastAPI injects validated dependencies before the handler runs.

## Stage 5: Deterministic Idempotency Key

```python
def generate_idempotency_key(user_id: str, match_id: str, timestamp: datetime) -> str:
    epoch_ms = timestamp_to_epoch_ms(timestamp)
    canonical = f"{user_id}:{match_id}:{epoch_ms}"
    return sha256(canonical.encode("utf-8")).hexdigest()
```

### Why Deterministic?

If a client retries the same logical bet submission, the same key is produced.

This enables downstream logic:

```sql
UNIQUE (idempotency_key)
```

The database becomes the final arbiter.

## Stage 6: Idempotency Over At-Least-Once Kafka

Kafka may redeliver.

You eliminate double-spend by combining:

```text
SHA-256 deterministic key + Kafka message key + DB unique index
```

Flow:

1. Ingress computes idempotency key.
2. Kafka stores it as message key and payload field.
3. Settlement checks whether it already exists.
4. DB unique constraint prevents race-condition duplicates.

Application checks are not enough. Two workers can race. The database unique index wins.

## Stage 7: Build the Kafka Event

```python
event = BetSubmittedEvent(
    event_id=event_id,
    bet_id=event_id,
    account_id=user.user_id,
    idempotency_key=idempotency_key,
    match_id=payload.match_id,
    market_id=payload.market_id,
    selection_id=payload.selection_id,
    stake_cents=decimal_money_to_cents(payload.stake),
    potential_payout_cents=decimal_money_to_cents(payload.potential_payout),
    odds=decimal_odds(payload.stake, payload.potential_payout),
    bet_timestamp_ms=timestamp_ms,
)
```

This event is immutable intent. It is not a database mutation.

## Stage 8: Publish Asynchronously

```python
await self._producer.send_and_wait(topic, key=key, value=payload_json)
```

Parameter meaning:

- `topic`: Kafka topic, e.g. `bets-submitted`.
- `key`: idempotency key, useful for partition locality.
- `value`: serialized event JSON.

The handler returns `202 Accepted`, not `200 Settled`.

## Stage 9: Keep the HTTP Handler Thin

Good handler responsibilities:

```text
authenticate -> validate -> build event -> publish -> return ack
```

Bad responsibilities:

```text
debit wallet -> insert bet -> settle match -> call risk inline
```

Thin boundaries make the system resilient and testable.

## Build a Better One — Exercises

1. Add a client-supplied idempotency key header and compare it with deterministic generation.
2. Add CSRF protection for cookie-authenticated requests.
3. Replace in-memory auth storage with PostgreSQL users while keeping bet handlers mutation-free.
4. Add OpenTelemetry spans for HTTP validation and Kafka publish latency.
5. Benchmark request throughput with and without JSON schema validation.
6. Add a dead-letter Kafka topic for publish failures or invalid internal events.


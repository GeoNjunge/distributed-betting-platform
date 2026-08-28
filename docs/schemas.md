# Event Schemas and Data Contracts

## Currency and Numeric Conventions

All persisted and risk-critical money values use integer cents.

| Concept | Representation | Example |
|---|---|---|
| $10.00 stake | `stake_cents: 1000` | integer |
| $100.00 wallet balance | `balance_cents: 10000` | integer |
| Decimal odds | string or decimal-compatible value | `"2.5000"` |
| Epoch timestamp | milliseconds since Unix epoch | `1787659200000` |

Rules:

- Do not use floating point for balances, stakes, or payouts.
- Convert dollars to cents at ingress boundaries with rounding: `Math.round(amount * 100)` in frontend and decimal-safe conversion in Python.
- Payout convention: `payout_cents = int(stake_cents * odds)` using decimal arithmetic in settlement code.

## Kafka Topics

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| `bets-submitted` | `ingress_service` | `risk_engine` | New bet intent after HTTP validation |
| `bets-results` | `risk_engine` | `settlement_worker` | Risk decision and settlement input |
| `odds-updates` | `odds_simulator` | `odds_service` | Tick-by-tick market odds |
| `match-outcomes` | Future outcome feed | Future consumer or settlement trigger | Match result event contract |

## `bets-submitted`

Produced by `ingress_service` and consumed by `risk_engine`.

### JSON Example

```json
{
  "event_id": "2c56bb34-e58b-57f1-9a8c-83a3fbff8f04",
  "bet_id": "2c56bb34-e58b-57f1-9a8c-83a3fbff8f04",
  "account_id": "dd3e8d4a-951f-5c9c-b6ea-25ee499f1acd",
  "idempotency_key": "3c4d0b7d7a9f2cc32133bb2d5fb52a79a2d93b4a45e3a4d113c3b57e7abc0001",
  "match_id": "match-0001",
  "market_id": "full-time-result",
  "selection_id": "home",
  "stake_cents": 1000,
  "potential_payout_cents": 2500,
  "odds": "2.5000",
  "bet_timestamp_ms": 1787659200000
}
```

### Field Definitions

| Field | Type | Required | Constraints | Description |
|---|---|---:|---|---|
| `event_id` | string | yes | 1-128 chars | Event identifier |
| `bet_id` | string | yes | 1-128 chars | Bet identifier, UUID-compatible in settlement |
| `account_id` | string | yes | 1-128 chars | User/account UUID |
| `idempotency_key` | string | yes | 1-128 chars | Deterministic duplicate-protection key |
| `match_id` | string | yes | 1-128 chars | Match identifier |
| `market_id` | string | yes | 1-128 chars | Market identifier |
| `selection_id` | string | yes | 1-128 chars | Selected outcome |
| `stake_cents` | integer | yes | `>= 1` | Stake in cents |
| `potential_payout_cents` | integer | yes | `>= 1`, should be `>= stake_cents` | Potential payout in cents |
| `odds` | string | yes | 1-32 chars | Decimal odds used for settlement |
| `bet_timestamp_ms` | integer | yes | `>= 1` | Client/ingress bet timestamp in epoch ms |

### Validation Contract

- Unknown fields are rejected by the C++ risk parser.
- Monetary values must be integers.
- `potential_payout_cents >= stake_cents`.
- Risk rejects stale events where `decision_time_ms - bet_timestamp_ms > 200`.

## `bets-results`

Produced by `risk_engine` and consumed by `settlement_worker`.

### JSON Example

```json
{
  "event_id": "2c56bb34-e58b-57f1-9a8c-83a3fbff8f04",
  "bet_id": "2c56bb34-e58b-57f1-9a8c-83a3fbff8f04",
  "account_id": "dd3e8d4a-951f-5c9c-b6ea-25ee499f1acd",
  "idempotency_key": "3c4d0b7d7a9f2cc32133bb2d5fb52a79a2d93b4a45e3a4d113c3b57e7abc0001",
  "match_id": "match-0001",
  "selection_id": "home",
  "stake_cents": 1000,
  "odds": "2.5000",
  "accepted": true,
  "reason_code": "ACCEPTED",
  "reason": "risk checks passed",
  "accepted_exposure_cents": 2500,
  "remaining_balance_cents": 9000,
  "decision_timestamp_ms": 1787659200030
}
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---:|---|
| `event_id` | string | yes | Original event identifier |
| `bet_id` | string UUID | yes | Bet identifier used as DB primary key |
| `account_id` | string UUID | yes | User/account UUID |
| `idempotency_key` | string | yes | Unique duplicate-suppression key |
| `match_id` | string | yes | Match identifier |
| `selection_id` | string | yes | Selected outcome |
| `stake_cents` | integer | yes | Stake in cents |
| `odds` | string | yes | Decimal odds |
| `accepted` | boolean | yes | Risk decision |
| `reason_code` | string enum | yes | Machine-readable decision code |
| `reason` | string | yes | Human-readable explanation |
| `accepted_exposure_cents` | integer | yes | Account exposure after acceptance |
| `remaining_balance_cents` | integer | yes | Risk-engine in-memory remaining balance |
| `decision_timestamp_ms` | integer | yes | Decision timestamp in epoch ms |

### `reason_code` Values

| Code | Meaning |
|---|---|
| `ACCEPTED` | Risk checks passed |
| `SCHEMA_INVALID` | Incoming event failed structural validation |
| `STALE_QUOTE` | Bet timestamp was older than the 200ms threshold |
| `ACCOUNT_NOT_FOUND` | Risk engine had no balance cell for account |
| `INSUFFICIENT_FUNDS` | In-memory risk balance was below stake |
| `SAEC_EXCEEDED` | Single-account exposure cap would be exceeded |

## `odds-updates`

Produced by `odds_simulator` and consumed by `odds_service`.

### JSON Example

```json
{
  "match_id": "match-0001",
  "market_id": "full-time-result",
  "selection_id": "home",
  "sequence": 42,
  "timestamp_ms": 1787659200000,
  "decimal_odds": "2.1400"
}
```

### Field Definitions

| Field | Type | Required | Constraints | Description |
|---|---|---:|---|---|
| `match_id` | string | yes | pattern `^[A-Za-z0-9_.:-]+$`, 1-128 chars | Match identifier |
| `market_id` | string | yes | pattern `^[A-Za-z0-9_.:-]+$`, 1-128 chars | Market identifier |
| `selection_id` | string | yes | pattern `^[A-Za-z0-9_.:-]+$`, 1-128 chars | Selection identifier |
| `sequence` | integer | yes | `>= 0` | Per-selection sequence |
| `timestamp_ms` | integer | yes | `>= 1` | Tick timestamp |
| `decimal_odds` | decimal/string | yes | `> 1.00`, `<= 1000.00`, up to 4 decimals | Current decimal odds |

## `match-outcomes`

The current implementation exposes match settlement via `POST /api/v1/settle-match`. The following Kafka event contract is reserved for a future asynchronous outcome feed.

### JSON Example

```json
{
  "event_id": "9dbdb454-1e69-4603-9bb9-9bbf0b5c1c52",
  "match_id": "match-0001",
  "winning_selection_id": "home",
  "result_timestamp_ms": 1787662800000,
  "source": "official-feed"
}
```

### Field Definitions

| Field | Type | Required | Constraints | Description |
|---|---|---:|---|---|
| `event_id` | string UUID | yes | valid UUID recommended | Outcome event identifier |
| `match_id` | string | yes | 1-128 chars | Settled match |
| `winning_selection_id` | string | yes | 1-128 chars | Winning selection |
| `result_timestamp_ms` | integer | yes | `>= 1` | Official result timestamp |
| `source` | string | no | 1-128 chars | Outcome source/feed name |

## Database Schema Contract

| Table | Purpose |
|---|---|
| `users` | Registered users mirrored for settlement/wallet ownership |
| `wallets` | Current wallet balance, with `balance_cents >= 0` check constraint |
| `bets` | Durable bet records keyed by UUID and unique idempotency key |
| `wallet_ledger` | Append-only audit log for deposits, stakes, and payouts |


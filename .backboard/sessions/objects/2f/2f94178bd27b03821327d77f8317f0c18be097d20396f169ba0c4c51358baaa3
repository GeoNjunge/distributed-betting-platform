# API Reference

## Base URLs

| Service | Base URL | Description |
|---|---|---|
| Ingress Service | `http://localhost:8000` | Auth and bet submission |
| Odds Service | `http://localhost:8001` | Health and WebSocket odds relay |
| Settlement Service | `http://localhost:8002` | Match settlement |

## Authentication Model

`ingress_service` issues JWTs in an HttpOnly cookie named `access_token` by default.

Local frontend requests must use credentials:

```ts
http.post(url, body, { withCredentials: true })
```

The backend CORS configuration allows `http://localhost:4200` by default.

## Ingress Service

### `GET /healthz`

Health check endpoint.

#### Response `200`

```json
{
  "status": "ok"
}
```

### `POST /register`

Registers a user and returns an HttpOnly JWT cookie.

#### Request

```json
{
  "email": "user@example.com",
  "password": "correct-horse-battery-staple"
}
```

#### Validation

| Field | Type | Constraints |
|---|---|---|
| `email` | string | valid email |
| `password` | string | 12-256 chars |

#### Response `201`

Headers include `Set-Cookie: access_token=...; HttpOnly`.

```json
{
  "user_id": "dd3e8d4a-951f-5c9c-b6ea-25ee499f1acd",
  "email": "user@example.com",
  "token_type": "bearer"
}
```

#### Errors

| Status | Reason |
|---:|---|
| `409` | Email already registered |
| `422` | Invalid request body |

### `POST /login`

Authenticates an existing user and returns an HttpOnly JWT cookie.

#### Request

```json
{
  "email": "user@example.com",
  "password": "correct-horse-battery-staple"
}
```

#### Response `200`

```json
{
  "user_id": "dd3e8d4a-951f-5c9c-b6ea-25ee499f1acd",
  "email": "user@example.com",
  "token_type": "bearer"
}
```

#### Errors

| Status | Reason |
|---:|---|
| `401` | Invalid credentials |
| `422` | Invalid request body |

### `POST /api/v1/bets`

Submits a bet intent. The endpoint validates and publishes to Kafka. It does not mutate bet or wallet database state.

#### Authentication

Requires `access_token` cookie.

#### Request

```json
{
  "match_id": "match-0001",
  "market_id": "full-time-result",
  "selection_id": "home",
  "stake": "10.00",
  "potential_payout": "25.00",
  "timestamp": "2026-08-25T12:00:00Z"
}
```

#### Validation

| Field | Type | Constraints |
|---|---|---|
| `match_id` | string | 1-128 chars |
| `market_id` | string | 1-128 chars |
| `selection_id` | string | 1-128 chars |
| `stake` | decimal | `> 0`, max 2 decimal places |
| `potential_payout` | decimal | `>= stake`, max 2 decimal places |
| `timestamp` | datetime | timezone-aware |

#### Response `202`

```json
{
  "event_id": "2c56bb34-e58b-57f1-9a8c-83a3fbff8f04",
  "idempotency_key": "3c4d0b7d7a9f2cc32133bb2d5fb52a79a2d93b4a45e3a4d113c3b57e7abc0001",
  "topic": "bets-submitted",
  "status": "published"
}
```

#### Errors

| Status | Reason |
|---:|---|
| `401` | Missing or invalid authentication cookie |
| `422` | Invalid body |
| `500` | Kafka publisher unavailable or failed |

## Odds Service

### `GET /healthz`

Returns service health and active WebSocket count.

#### Response `200`

```json
{
  "status": "ok",
  "active_websockets": 3
}
```

### `WebSocket /ws/odds`

Streams live odds ticks to clients.

#### URL

```text
ws://localhost:8001/ws/odds
```

#### Message Format

Each server-to-client message is a JSON encoded `odds-updates` tick.

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

#### Runtime Behavior

- Server-push stream.
- Clients may send text messages only to keep the connection active or detect disconnects.
- Slow clients are disconnected when their bounded per-client queue fills.

## Settlement Service

### `GET /healthz`

Health check endpoint.

#### Response `200`

```json
{
  "status": "ok"
}
```

### `POST /api/v1/settle-match`

Settles all accepted bets for a match.

#### Request

```json
{
  "match_id": "match-0001",
  "winning_selection_id": "home"
}
```

#### Validation

| Field | Type | Constraints |
|---|---|---|
| `match_id` | string | 1-128 chars |
| `winning_selection_id` | string | 1-128 chars |

#### Response `200`

```json
{
  "match_id": "match-0001",
  "winning_selection_id": "home",
  "winning_bets": 1,
  "losing_bets": 2,
  "total_payout_cents": 2500
}
```

#### Side Effects

Within a database transaction:

- locks accepted bets for the match,
- marks winning bets `WON`,
- marks losing bets `LOST`,
- credits winning user wallets,
- writes `BET_PAYOUT` ledger entries.

#### Errors

| Status | Reason |
|---:|---|
| `422` | Invalid body |
| `500` | Database failure |

## Frontend Integration Endpoints

The Angular SPA uses:

| Frontend Action | Endpoint |
|---|---|
| Register | `POST http://localhost:8000/register` |
| Login | `POST http://localhost:8000/login` |
| Submit bet | `POST http://localhost:8000/api/v1/bets` |
| Stream odds | `ws://localhost:8001/ws/odds` |
| Settle match in test/admin flow | `POST http://localhost:8002/api/v1/settle-match` |


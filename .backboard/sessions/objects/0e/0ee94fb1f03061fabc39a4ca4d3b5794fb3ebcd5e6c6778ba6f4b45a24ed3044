# Ingress Service

## Overview

`ingress_service` is the HTTP boundary for registration, login, and bet submission. It validates requests, issues JWT cookies, generates deterministic idempotency keys, and publishes bet events to Kafka.

It does not directly mutate bet or wallet database state.

## Architectural Role

- Owns user-facing auth endpoints.
- Issues HttpOnly JWT cookies.
- Validates bet requests with Pydantic.
- Publishes `bets-submitted` events through `aiokafka`.

## Technology Stack

| Dependency | Purpose |
|---|---|
| FastAPI | HTTP API |
| Pydantic v2 | Request/event validation |
| aiokafka | Async Kafka producer |
| PyJWT | JWT creation/validation |
| hashlib PBKDF2-HMAC-SHA256 | Password hashing |
| Uvicorn | ASGI server |

## Folder Structure

```text
ingress_service/
├── Dockerfile
├── README.md
├── requirements.txt
├── .env.example
└── app/
    ├── main.py
    ├── core/
    │   └── config.py
    ├── routers/
    │   ├── auth.py
    │   └── bets.py
    ├── schemas/
    │   ├── auth.py
    │   ├── bets.py
    │   └── events.py
    └── services/
        ├── idempotency.py
        ├── kafka.py
        └── security.py
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | `change-me-in-production` | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT/cookie lifetime |
| `AUTH_COOKIE_NAME` | `access_token` | Cookie name |
| `COOKIE_SECURE` | `true` | Secure cookie flag |
| `COOKIE_SAMESITE` | `lax` | SameSite mode |
| `COOKIE_DOMAIN` | unset | Optional domain |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `BETS_SUBMITTED_TOPIC` | `bets-submitted` | Output topic |
| `CORS_ALLOW_ORIGINS` | `http://localhost:4200` | Allowed browser origins |

## Local Setup

```bash
cd ingress_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run Locally

```bash
COOKIE_SECURE=false \
JWT_SECRET_KEY=local-dev-secret \
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 \
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Example Requests

Register:

```bash
curl -i -X POST http://localhost:8000/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"correct-horse-battery-staple"}'
```

Submit bet with cookie:

```bash
curl -i -X POST http://localhost:8000/api/v1/bets \
  -H 'Content-Type: application/json' \
  -b 'access_token=<jwt>' \
  -d '{
    "match_id":"match-0001",
    "market_id":"full-time-result",
    "selection_id":"home",
    "stake":"10.00",
    "potential_payout":"25.00",
    "timestamp":"2026-08-25T12:00:00Z"
  }'
```

## Tests and Checks

```bash
python3 -m compileall -q app
curl http://localhost:8000/healthz
```


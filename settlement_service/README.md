# Settlement Service

## Overview

`settlement_service` persists risk results, manages wallet debits, records immutable audit ledger entries, and exposes a match settlement API.

It contains two runtime modes:

- `settlement-api`: FastAPI HTTP API for match settlement.
- `settlement-worker`: Kafka consumer for `bets-results`.

## Architectural Role

- Consumes accepted/rejected risk decisions.
- Prevents duplicate wallet deductions with `bets.idempotency_key`.
- Performs atomic wallet debits.
- Writes append-only ledger entries.
- Settles accepted bets when match outcomes are known.

## Technology Stack

| Dependency | Purpose |
|---|---|
| FastAPI | Settlement HTTP API |
| SQLAlchemy async | ORM and async database access |
| asyncpg | PostgreSQL driver |
| aiokafka | Kafka consumer |
| Pydantic v2 | Event/API validation |
| PostgreSQL | Durable wallet/bet storage |

## Folder Structure

```text
settlement_service/
├── Dockerfile
├── README.md
├── requirements.txt
├── .env.example
└── app/
    ├── config.py
    ├── database.py
    ├── main.py
    ├── models.py
    ├── schemas.py
    ├── settlement.py
    ├── mpesa.py
    ├── mpesa_routes.py
    ├── worker.py
    ├── oauth_request.py
    ├── stk_push.py
    ├── webhook_version.py
    └── sms_otp_demo.py
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/betting` | SQLAlchemy async database URL |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `BETS_RESULTS_TOPIC` | `bets-results` | Input topic |
| `KAFKA_CONSUMER_GROUP` | `settlement-service-v1` | Worker consumer group |
| `APP_NAME` | `settlement-service` | FastAPI title |
| `CONSUMER_KEY` | _(required for M-Pesa)_ | Safaricom Daraja consumer key |
| `CONSUMER_SECRET` | _(required for M-Pesa)_ | Safaricom Daraja consumer secret |
| `MPESA_SHORTCODE` | `174379` | Paybill / till shortcode (sandbox default) |
| `MPESA_PASSKEY` | sandbox passkey | STK password signing passkey |
| `MPESA_BASE_URL` | `https://sandbox.safaricom.co.ke` | Daraja host (swap for production URL) |
| `NGROK_URL` | _(local dev)_ | ngrok HTTPS base URL; app builds `…/api/v1/mpesa/callback` automatically |
| `MPESA_CALLBACK_URL` | _(optional)_ | Override full callback URL (default: `{NGROK_URL}/api/v1/mpesa/callback`) |
| `MPESA_TRANSACTION_TYPE` | `CustomerPayBillOnline` | Daraja `TransactionType` for STK Push |
| `MPESA_OAUTH_REFRESH_SKEW_SECONDS` | `60` | Refresh OAuth token this many seconds before expiry |
| `AFRICAS_TALKING_API_KEY` | _(optional)_ | Only for the standalone `sms_otp_demo.py` script |

## M-Pesa STK Push (local + ngrok)

Safaricom delivers STK results asynchronously to your callback URL. On a laptop, that URL must be reachable from the internet—typically via [ngrok](https://ngrok.com/).

1. Start the settlement API on port **8002** (see [Run API](#run-api)).
2. In another terminal, forward that port:

```bash
ngrok http 8002
```

3. Copy the HTTPS forwarding URL from the ngrok dashboard (for example `https://abc123.ngrok-free.app`). **Do not** add a trailing slash.
4. Set it in `settlement_service/.env`:

```bash
NGROK_URL=https://abc123.ngrok-free.app
```

   Do **not** use webhook.site for `CallBackURL` if you want the wallet credited automatically—Safaricom must reach this API via ngrok.

5. **Restart `uvicorn`** (settings are cached for the process lifetime), then trigger a deposit:

```bash
curl -X POST http://localhost:8002/api/v1/mpesa/stk-push \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "00000000-0000-4000-8000-000000000001",
    "phone_number": "254712345678",
    "amount": 1,
    "account_reference": "DEPOSIT",
    "transaction_desc": "Wallet deposit"
  }'
```

When you approve the prompt on the handset, Safaricom POSTs to `MPESA_CALLBACK_URL`. A successful payment credits the wallet (KES × 100 → cents), appends a `DEPOSIT` ledger row, and marks the `mpesa_transactions` row `SUCCESS`.

OAuth tokens are cached in application memory and refreshed automatically when missing or within 60 seconds of expiry (`MPESA_OAUTH_REFRESH_SKEW_SECONDS`).

## Local Setup

```bash
cd settlement_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Initialize Schema

```bash
python - <<'PY'
import asyncio
from app.database import create_all
asyncio.run(create_all())
PY
```

## Run API

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/betting \
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

## Run Worker

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/betting \
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 \
python -m app.worker
```

## Example Settlement Request

```bash
curl -X POST http://localhost:8002/api/v1/settle-match \
  -H 'Content-Type: application/json' \
  -d '{"match_id":"match-0001","winning_selection_id":"home"}'
```

## Tests and Checks

```bash
python3 -m compileall -q app
curl http://localhost:8002/healthz
```


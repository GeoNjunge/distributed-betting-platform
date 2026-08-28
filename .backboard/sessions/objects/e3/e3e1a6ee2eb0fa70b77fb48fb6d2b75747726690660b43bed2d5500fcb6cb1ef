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
    └── worker.py
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/betting` | SQLAlchemy async database URL |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `BETS_RESULTS_TOPIC` | `bets-results` | Input topic |
| `KAFKA_CONSUMER_GROUP` | `settlement-service-v1` | Worker consumer group |
| `APP_NAME` | `settlement-service` | FastAPI title |

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


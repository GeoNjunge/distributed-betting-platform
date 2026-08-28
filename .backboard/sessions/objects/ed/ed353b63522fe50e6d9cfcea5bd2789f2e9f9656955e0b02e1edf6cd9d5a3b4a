# Deployment and Operations Guide

## Prerequisites

For Docker Compose deployment:

- Docker Engine or Docker Desktop
- Docker Compose v2

For native development:

- Python 3.11+
- CMake 3.20+
- GCC 13 or Clang with C++20 support
- PostgreSQL 16+
- Kafka 3.7+
- Node.js 20+ for Angular frontend

## Docker Compose Deployment

From the repository root:

```bash
cd distributed_betting_platform
docker compose up --build
```

This starts:

- Kafka in KRaft mode,
- PostgreSQL,
- C++ risk engine,
- FastAPI ingress service,
- odds WebSocket relay,
- odds simulator,
- settlement API,
- settlement worker.

## Health Checks

Kafka health check:

```bash
kafka-topics.sh --bootstrap-server localhost:9092 --list
```

PostgreSQL health check:

```bash
pg_isready -U postgres -d betting
```

HTTP health checks:

```bash
curl http://localhost:8000/healthz
curl http://localhost:8001/healthz
curl http://localhost:8002/healthz
```

## Docker Compose Services

| Service | Purpose | Host Port |
|---|---|---:|
| `kafka` | Event broker | 9092 |
| `postgres` | Database | 5432 |
| `risk-engine` | Risk evaluator | none |
| `ingress-service` | Auth and bet ingress | 8000 |
| `odds-service` | WebSocket odds relay | 8001 |
| `odds-simulator` | Market-data simulator | none |
| `settlement-api` | Settlement HTTP API | 8002 |
| `settlement-worker` | Kafka settlement consumer | none |

## Environment Variables

### Shared Kafka

| Variable | Default | Used By | Description |
|---|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Python services, risk engine | Kafka bootstrap servers |
| `BETS_SUBMITTED_TOPIC` | `bets-submitted` | ingress, risk | Bet submission topic |
| `BETS_RESULTS_TOPIC` | `bets-results` | risk, settlement | Risk result topic |
| `ODDS_UPDATES_TOPIC` | `odds-updates` | odds services | Odds tick topic |

### Ingress Service

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET_KEY` | development placeholder | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Cookie/JWT lifetime |
| `AUTH_COOKIE_NAME` | `access_token` | JWT cookie name |
| `COOKIE_SECURE` | `true` | Secure cookie flag |
| `COOKIE_SAMESITE` | `lax` | Cookie SameSite mode |
| `COOKIE_DOMAIN` | unset | Optional cookie domain |
| `CORS_ALLOW_ORIGINS` | `http://localhost:4200` | Allowed frontend origins |

### Risk Engine

| Variable | Default | Description |
|---|---|---|
| `KAFKA_GROUP_ID` | `risk-engine-v1` | Consumer group |
| `SAEC_CAP_CENTS` | `1000000` | Single-account exposure cap |
| `DEMO_BALANCE_CENTS` | `100000` | Demo account risk balance |
| `RISK_BALANCE_SEEDS` | unset | Comma-separated `account_id:balance_cents` seeds |

### Settlement Service

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/betting` | SQLAlchemy async DB URL |
| `KAFKA_CONSUMER_GROUP` | `settlement-service-v1` | Worker consumer group |
| `APP_NAME` | `settlement-service` | FastAPI title |

### Odds Service

| Variable | Default | Description |
|---|---|---|
| `KAFKA_CONSUMER_GROUP` | `odds-websocket-relay` | Odds relay consumer group |
| `SIMULATOR_MATCH_COUNT` | `8` | Simulated matches |
| `SIMULATOR_TICK_INTERVAL_MS` | `50` | Tick cadence |

## PostgreSQL Schema Setup

The settlement API creates SQLAlchemy metadata on startup for local/standalone operation.

For explicit setup, start PostgreSQL and run:

```bash
cd settlement_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python - <<'PY'
import asyncio
from app.database import create_all
asyncio.run(create_all())
PY
```

Production deployments should replace auto-create behavior with Alembic migrations.

## Native Local Development

### Risk Engine

```bash
cd risk_engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DRISK_ENGINE_ENABLE_ASAN=OFF
cmake --build build
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 ./build/risk_engine
```

Install dependencies on Debian/Ubuntu:

```bash
sudo apt-get install cmake ninja-build librdkafka-dev nlohmann-json3-dev
```

### Ingress Service

```bash
cd ingress_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
COOKIE_SECURE=false uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Odds Service

Run WebSocket relay:

```bash
cd odds_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Run simulator:

```bash
python simulator.py
```

### Settlement Service

Run API:

```bash
cd settlement_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

Run worker:

```bash
python -m app.worker
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Open:

```text
http://localhost:4200
```

## End-to-End Test

Start the stack:

```bash
docker compose up --build
```

Run the E2E test from another shell:

```bash
python3 -m venv .venv-e2e
source .venv-e2e/bin/activate
pip install -r scripts/requirements.txt
python scripts/test_e2e.py
```

## Troubleshooting

### Kafka health check fails

Symptoms:

- Services wait indefinitely on Kafka.
- Kafka logs show listener or KRaft errors.

Actions:

```bash
docker compose logs kafka
```

Check:

- `KAFKA_CFG_ADVERTISED_LISTENERS`,
- host port `9092` availability,
- stale container volume state.

### PostgreSQL connection errors

Symptoms:

- `asyncpg.exceptions.CannotConnectNowError`,
- settlement API or worker fails on startup.

Actions:

```bash
docker compose logs postgres
docker compose ps
```

Verify `DATABASE_URL` points to `postgres` inside Compose and `localhost` for host-native runs.
For the local process runner, the default is `postgresql+asyncpg://postgres:postgres@localhost:5432/betting`; override `DATABASE_URL` if your local PostgreSQL password differs.

### Bets remain unprocessed

Check each stage:

1. `ingress_service` logs show Kafka publish success.
2. `risk_engine` is consuming `bets-submitted`.
3. `risk_engine` has risk balance seeded for the account.
4. `settlement_worker` is consuming `bets-results`.
5. DB contains matching user and wallet rows.

### Risk rejects stale quote

`risk_engine` rejects when:

```text
decision_time_ms - bet_timestamp_ms > 200
```

Use synchronized clocks and low-latency submission paths. The E2E script uses a slightly future timestamp to avoid false failures during cold Docker startup.

### Frontend login works but bet submit is unauthorized

Check:

- `COOKIE_SECURE=false` for local HTTP,
- CORS origin includes `http://localhost:4200`,
- Angular uses `{ withCredentials: true }`.

### Odds WebSocket receives no ticks

Check:

```bash
docker compose logs odds-simulator odds-service kafka
```

Verify:

- `odds-simulator` is running,
- topic `odds-updates` exists,
- browser connects to `ws://localhost:8001/ws/odds`.


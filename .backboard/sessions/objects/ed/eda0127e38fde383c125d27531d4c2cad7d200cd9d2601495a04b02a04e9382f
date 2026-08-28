# Scripts

## Overview

`scripts/` contains operational and test scripts for validating the integrated platform.

The primary script is `test_e2e.py`, which exercises the complete betting lifecycle across HTTP, WebSocket, Kafka-driven services, and PostgreSQL.

## Architectural Role

- Seeds PostgreSQL with a deterministic test user and wallet balance.
- Registers/logs in through `ingress_service`.
- Reads live odds through `odds_service` WebSocket.
- Submits a bet through `ingress_service`.
- Verifies wallet debit and ledger writes by `settlement_worker`.
- Calls `settlement_service` to settle a match and verifies payout credit.

## Technology Stack

| Dependency | Purpose |
|---|---|
| Python 3.11+ | Script runtime |
| asyncpg | PostgreSQL checks and seed data |
| websockets | Odds WebSocket client |
| urllib stdlib | HTTP API calls with cookie jar |

## Folder Structure

```text
scripts/
├── README.md
├── requirements.txt
└── test_e2e.py
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `INGRESS_URL` | `http://localhost:8000` | Ingress API base URL |
| `ODDS_WS_URL` | `ws://localhost:8001/ws/odds` | Odds WebSocket URL |
| `SETTLEMENT_URL` | `http://localhost:8002` | Settlement API base URL |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/betting` | Host-side PostgreSQL URL |
| `E2E_EMAIL` | `e2e-user@example.com` | Test account email |
| `E2E_PASSWORD` | `correct-horse-battery-staple` | Test account password |

## Local Setup

```bash
cd distributed_betting_platform
python3 -m venv .venv-e2e
source .venv-e2e/bin/activate
pip install -r scripts/requirements.txt
```

## Run End-to-End Test

Start the stack:

```bash
docker compose up --build
```

Run the script:

```bash
python scripts/test_e2e.py
```

## Expected Success Output

```text
PASS: settlement=..., final_balance_cents=...
```

## Troubleshooting

- If HTTP readiness fails, check service logs with `docker compose logs ingress-service settlement-api`.
- If no odds ticks arrive, check `docker compose logs odds-simulator odds-service kafka`.
- If debit verification fails, check `risk-engine` and `settlement-worker` logs.
- If PostgreSQL connection fails, confirm port `5432` is exposed and `DATABASE_URL` uses the host URL.


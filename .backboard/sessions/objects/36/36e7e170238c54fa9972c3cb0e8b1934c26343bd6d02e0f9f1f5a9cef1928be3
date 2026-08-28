# Odds Service

## Overview

`odds_service` provides real-time market data. It includes a simulator that publishes tick-by-tick odds to Kafka and a FastAPI WebSocket relay that broadcasts ticks to browser clients.

## Architectural Role

- `simulator.py` generates odds every 50ms.
- `app/main.py` consumes `odds-updates` and broadcasts over `/ws/odds`.
- The relay avoids decode/re-encode on the hot path by broadcasting raw Kafka JSON bytes.

## Technology Stack

| Dependency | Purpose |
|---|---|
| FastAPI | WebSocket server and health endpoint |
| aiokafka | Kafka producer/consumer |
| Pydantic v2 | Odds tick schema validation |
| asyncio | Epoll-friendly connection handling |
| Uvicorn | ASGI server |

## Folder Structure

```text
odds_service/
├── Dockerfile
├── README.md
├── requirements.txt
├── simulator.py
├── websocket_server.py
├── .env.example
└── app/
    ├── config.py
    ├── main.py
    ├── schemas/
    │   ├── odds.py
    │   └── odds-update.schema.json
    └── services/
        ├── codec.py
        ├── connection_manager.py
        └── kafka.py
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `ODDS_UPDATES_TOPIC` | `odds-updates` | Odds topic |
| `KAFKA_CONSUMER_GROUP` | `odds-websocket-relay` | Relay consumer group |
| `SIMULATOR_MATCH_COUNT` | `8` | Number of matches to simulate |
| `SIMULATOR_TICK_INTERVAL_MS` | `50` | Tick interval |

## Local Setup

```bash
cd odds_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run WebSocket Relay

```bash
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 \
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Run Simulator

```bash
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 \
SIMULATOR_MATCH_COUNT=8 \
SIMULATOR_TICK_INTERVAL_MS=50 \
python simulator.py
```

## Connect to WebSocket

```text
ws://localhost:8001/ws/odds
```

## Tests and Checks

```bash
python3 -m compileall -q .
python3 -m json.tool app/schemas/odds-update.schema.json >/dev/null
curl http://localhost:8001/healthz
```


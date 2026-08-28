# Risk Engine

## Overview

`risk_engine` is a standalone Modern C++20 microservice responsible for pre-trade risk evaluation. It consumes validated bet intents from Kafka topic `bets-submitted`, applies low-latency risk checks, emits decisions to `bets-results`, and manually commits Kafka offsets only after result production completes.

## Architectural Role

- Protects against stale quotes.
- Enforces single-account exposure caps.
- Performs lock-free in-memory balance debits with atomics.
- Produces settlement-compatible risk result events.

## Technology Stack

| Dependency | Purpose |
|---|---|
| C++20 | Low-latency risk logic |
| librdkafka C++ bindings | Kafka consumer/producer |
| CMake | Build system |
| AddressSanitizer | Debug memory safety builds |
| Docker gcc:13 | Production container build |

## Folder Structure

```text
risk_engine/
├── CMakeLists.txt
├── Dockerfile
├── README.md
├── include/
│   └── risk_engine.hpp
├── proto/
│   └── risk_events.proto
├── schemas/
│   ├── bets-results.schema.json
│   └── bets-submitted.schema.json
└── src/
    ├── main.cpp
    └── risk_engine.cpp
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `BETS_SUBMITTED_TOPIC` | `bets-submitted` | Input topic |
| `BETS_RESULTS_TOPIC` | `bets-results` | Output topic |
| `KAFKA_GROUP_ID` | `risk-engine-v1` | Consumer group |
| `SAEC_CAP_CENTS` | `1000000` | Single-account exposure cap |
| `DEMO_BALANCE_CENTS` | `100000` | Demo risk balance |
| `RISK_BALANCE_SEEDS` | unset | Comma-separated `account_id:balance_cents` seed list |

## Local Build

Install dependencies:

```bash
sudo apt-get update
sudo apt-get install -y cmake ninja-build librdkafka-dev nlohmann-json3-dev
```

Build debug/ASAN:

```bash
cd risk_engine
cmake -S . -B build -G Ninja -DRISK_ENGINE_ENABLE_ASAN=ON
cmake --build build
```

Build optimized release:

```bash
cmake -S . -B build -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DRISK_ENGINE_ENABLE_ASAN=OFF \
  -DCMAKE_CXX_FLAGS_RELEASE="-O3 -DNDEBUG -flto" \
  -DCMAKE_EXE_LINKER_FLAGS_RELEASE="-flto"
cmake --build build
```

## Run Locally

```bash
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 \
SAEC_CAP_CENTS=1000000 \
RISK_BALANCE_SEEDS="demo-account:100000" \
./build/risk_engine
```

## Docker

```bash
docker build -t risk-engine ./risk_engine
docker run --rm --network host risk-engine
```

## Smoke Checks

```bash
cmake --build build
python3 -m json.tool schemas/bets-submitted.schema.json >/dev/null
python3 -m json.tool schemas/bets-results.schema.json >/dev/null
```


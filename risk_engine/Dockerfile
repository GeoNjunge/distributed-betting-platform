FROM gcc:13 AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake ninja-build librdkafka-dev nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .
RUN cmake -S . -B build -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DRISK_ENGINE_ENABLE_ASAN=OFF \
      -DCMAKE_CXX_FLAGS_RELEASE="-O3 -DNDEBUG -flto" \
      -DCMAKE_EXE_LINKER_FLAGS_RELEASE="-flto" \
    && cmake --build build --target risk_engine

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends librdkafka++1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /src/build/risk_engine ./build/risk_engine
CMD ["./build/risk_engine"]

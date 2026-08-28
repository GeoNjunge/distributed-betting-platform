# 01 — Low-Latency C++ Risk Engine

## Goal

Build a C++20 Kafka microservice that consumes `bets-submitted`, performs pre-trade risk checks, and emits `bets-results`.

The central engineering question:

```text
How do we make the decision path predictable, memory-safe, and fast?
```

## Stage 1: Define the In-Memory Bet Shape

Start with an owned representation:

```cpp
struct BetSubmitted {
    std::string event_id;
    std::string bet_id;
    std::string account_id;
    std::string idempotency_key;
    std::string match_id;
    std::string market_id;
    std::string selection_id;
    std::string odds;
    std::int64_t stake_cents{};
    std::int64_t potential_payout_cents{};
    std::int64_t bet_timestamp_ms{};
};
```

### Why `std::string`?

Kafka message payload memory is owned by librdkafka. Once the message object is destroyed, raw payload pointers are invalid.

So the parser may inspect bytes with `std::string_view`, but fields that survive parsing must be copied into owning storage.

```cpp
BetResult evaluate_json(std::string_view payload);
```

Parameter explanation:

- `std::string_view payload`: non-owning view of Kafka bytes.
- No heap allocation just to pass bytes into the parser.
- No mutation of Kafka-owned memory.

## Stage 2: Parse Payload Bytes Without Premature Copies

A high-performance parser pipeline should look like:

```text
Kafka bytes -> string_view -> validate tokens -> copy only accepted fields
```

Avoid this on the hot path:

```cpp
std::string copied_payload(static_cast<char*>(msg->payload()), msg->len());
```

Instead:

```cpp
const auto* bytes = static_cast<const char*>(msg->payload());
const std::string_view payload(bytes, msg->len());
const auto result = engine.evaluate_json(payload);
```

### Memory Layout Decision

`string_view` is typically two machine words:

```text
pointer + length
```

It does not allocate and does not own. That is good for parsing, dangerous for storage.

Rule:

```text
Use string_view for temporary inspection.
Use string for retained fields.
```

## Stage 3: Stale Quote Protection

Implement the first risk rule:

```cpp
constexpr std::int64_t kStaleQuoteProtectionMs = 200;

const std::int64_t quote_age_ms = decision_time - bet.bet_timestamp_ms;
if (quote_age_ms > kStaleQuoteProtectionMs) {
    result.accepted = false;
    result.reason_code = "STALE_QUOTE";
    return result;
}
```

Parameter meaning:

- `decision_time`: server time when risk decision starts.
- `bet_timestamp_ms`: client or ingress timestamp.
- `200ms`: maximum accepted quote age.

### Why This Matters

In betting, stale odds are toxic. A user could submit a bet after the price has moved. Stale quote protection reduces adverse selection.

## Stage 4: Atomic Balance Cells

Use a map from account ID to atomic balance:

```cpp
std::unordered_map<std::string, std::unique_ptr<std::atomic<std::int64_t>>> balances_;
```

### Why `unique_ptr<atomic<int64_t>>`?

`std::atomic` is non-copyable. `std::unordered_map` may rehash. A `unique_ptr` gives each atomic cell a stable heap address even if the map buckets move.

Memory ownership:

```text
unordered_map owns unique_ptr
unique_ptr owns atomic<int64_t>
no raw owning pointer escapes
```

## Stage 5: Implement the CAS Loop

```cpp
std::int64_t current = balance.load(std::memory_order_acquire);
while (true) {
    if (current < stake_cents) {
        remaining_balance_cents = current;
        return BalanceDebitResult::InsufficientFunds;
    }

    const std::int64_t desired = current - stake_cents;
    if (balance.compare_exchange_weak(
            current,
            desired,
            std::memory_order_acq_rel,
            std::memory_order_acquire)) {
        remaining_balance_cents = desired;
        return BalanceDebitResult::Debited;
    }
}
```

### Explain Every Parameter

`compare_exchange_weak(current, desired, success_order, failure_order)`:

| Parameter | Meaning |
|---|---|
| `current` | Expected value. On failure, overwritten with actual value. |
| `desired` | New value if expected matched. |
| `memory_order_acq_rel` | Acquire previous writes and release this debit. |
| `memory_order_acquire` | On failure, acquire latest value for retry. |

### `weak` vs `strong`

- `compare_exchange_weak` may fail spuriously and is ideal inside loops.
- `compare_exchange_strong` avoids spurious failure and is often simpler for one-shot transitions.

Exercise: change the loop to `compare_exchange_strong` and benchmark it.

## Stage 6: Cache Line Deep Dive

Modern CPUs move memory in cache lines, often 64 bytes.

False sharing happens when two hot atomics share a cache line:

```text
core 1 writes account A balance
core 2 writes account B balance
same cache line bounces between cores
```

C++ exposes hints:

```cpp
#include <new>

struct alignas(std::hardware_destructive_interference_size) BalanceCell {
    std::atomic<std::int64_t> value;
};
```

Why not always do this?

- It increases memory usage.
- It may reduce cache density for read-heavy workloads.
- You should benchmark under expected account contention.

## Stage 7: Ban Heap Allocations on the Execution Hot Path

The ideal risk hot path after startup:

```text
parse -> validate -> atomic debit -> exposure update -> serialize
```

Heap allocations cause:

- allocator lock contention,
- unpredictable latency spikes,
- cache misses,
- fragmentation.

Practical steps:

- reserve output JSON string capacity,
- keep account cells allocated at startup or hydration time,
- avoid per-message logging,
- avoid exceptions for normal rejections.

## Stage 8: Manual Kafka Offset Commit

At-least-once processing requires careful commit placement:

```cpp
if (!produce_result(...)) {
    continue; // no commit
}

if (producer->flush(5000) != 0) {
    continue; // no commit
}

consumer->commitSync(msg.get());
```

Only commit after the externally visible execution step completes.

If the service crashes after producing but before commit, the input may replay. Settlement idempotency handles that.

## Stage 9: Serialize Without Dangling Pointers

For outbound Kafka production:

```cpp
producer.produce(
    topic,
    RdKafka::Topic::PARTITION_UA,
    RdKafka::Producer::RK_MSG_COPY,
    const_cast<char*>(payload.data()),
    payload.size(),
    &key,
    nullptr);
```

`RK_MSG_COPY` tells librdkafka to copy the buffer before the local `std::string` is destroyed.

Zero-copy is faster but requires exact lifetime ownership. In this service, correctness beats a dangerous dangling pointer.

## Build a Better One — Exercises

1. Replace `std::unordered_map` with a cache-friendly flat hash map and benchmark P99.
2. Add `alignas(std::hardware_destructive_interference_size)` balance cells.
3. Pre-allocate account balance cells from a memory pool.
4. Add latency timestamps to `bets-results` and compute risk decision latency.
5. Implement a binary protocol parser and compare it with JSON parsing.
6. Add a benchmark that runs 1 million CAS debits across 1, 10, and 10,000 accounts.


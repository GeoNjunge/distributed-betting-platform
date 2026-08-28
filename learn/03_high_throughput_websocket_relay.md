# 03 — High-Throughput WebSocket Relay

## Goal

Build a real-time odds system that generates market ticks, publishes them to Kafka, consumes them, and broadcasts to many WebSocket clients with low tail latency.

## Stage 1: Generate Market Ticks

A tick represents the latest price for one selection:

```python
class OddsTick(BaseModel):
    match_id: str
    market_id: str
    selection_id: str
    sequence: int
    timestamp_ms: int
    decimal_odds: Decimal
```

The simulator updates odds every 50ms:

```python
while not stop_event.is_set():
    for selection in selections:
        tick = selection.next_tick()
        payload = encode_tick(tick)
        await producer.publish_tick(topic=topic, key=key, payload=payload)
```

## Stage 2: Serialize Once

```python
def encode_tick(tick: OddsTick) -> bytes:
    return tick.model_dump_json().encode("utf-8")
```

The output is immutable bytes.

Why this matters:

```text
Kafka value bytes -> WebSocket send_bytes(bytes)
```

No parse/re-encode cycle is needed in the relay.

## Stage 3: Zero-Copy and Byte Pipelines

Strictly speaking, Python WebSocket sending still copies between user-space and kernel-space. But you can avoid unnecessary application-level copies:

Bad hot path:

```python
obj = json.loads(message.value)
text = json.dumps(obj)
await websocket.send_text(text)
```

Better hot path:

```python
payload = message.value
await manager.broadcast(payload)
```

Benefits:

- lower allocator pressure,
- less Python garbage collection,
- fewer CPU cycles per tick,
- lower P99 latency during bursts.

## Stage 4: Linux I/O Multiplexing Deep Dive

A socket is represented by a file descriptor.

Blocking model:

```text
one thread waits on one socket
```

This does not scale to many clients.

Non-blocking model with epoll:

```text
one event loop asks kernel: which sockets are ready?
kernel returns ready file descriptors
event loop resumes only those tasks
```

### Kernel vs User-Space Buffers

When you call `send`:

```text
Python bytes -> ASGI server -> kernel socket send buffer -> NIC
```

If the kernel socket buffer is full, the socket is not writable. Async frameworks suspend the task until it becomes writable.

If one broadcast loop awaits a slow socket, all clients suffer.

## Stage 5: Use Per-Client Queues

```python
@dataclass(slots=True, eq=False)
class ClientConnection:
    websocket: WebSocket
    queue: asyncio.Queue[bytes] = field(default_factory=lambda: asyncio.Queue(maxsize=256))
    writer_task: asyncio.Task[None] | None = None
```

Parameter choices:

- `slots=True`: avoids per-instance `__dict__`, reducing memory per client.
- `eq=False`: keeps object identity hashing for set membership.
- `Queue[bytes]`: stores already-serialized payloads.
- `maxsize=256`: bounded memory and backpressure signal.

## Stage 6: Broadcast Without Awaiting Slow Sockets

```python
async def broadcast(self, payload: bytes) -> None:
    async with self._lock:
        clients = tuple(self._clients)

    stale = []
    for client in clients:
        try:
            client.queue.put_nowait(payload)
        except asyncio.QueueFull:
            stale.append(client)

    if stale:
        await asyncio.gather(*(self.disconnect(client) for client in stale), return_exceptions=True)
```

This is epoll-friendly because broadcast only enqueues. Each client writer task handles actual socket IO independently.

## Stage 7: Writer Task

```python
async def _writer(self, client: ClientConnection) -> None:
    while True:
        payload = await client.queue.get()
        await client.websocket.send_bytes(payload)
```

If `send_bytes` blocks due to kernel backpressure, only that client's writer task waits.

## Stage 8: Frontend High-Frequency State with Signals

Angular signal state:

```ts
private readonly marketsSignal = signal<Record<string, MarketSelectionView>>({});
```

Update on each tick:

```ts
this.marketsSignal.update((current) => ({
  ...current,
  [key]: nextSelection
}));
```

Signals are useful for high-frequency UI updates because dependent views recompute from explicit state changes.

## Stage 9: Price Flash Indicators

```ts
const direction = previous
  ? odds > previous.odds ? 'up' : odds < previous.odds ? 'down' : 'flat'
  : 'flat';
```

Render:

```html
<button [ngClass]="priceClasses(selection)">
```

Green for up, red for down.

## Stage 10: Benchmark Tail Latency

Measure:

```text
producer timestamp_ms -> browser receive time
```

Metrics:

- P50: normal path,
- P95: moderate load,
- P99: tail latency,
- max: worst observed client experience.

Tail latency gets worse when:

- JSON is parsed/re-encoded per client,
- queues are unbounded,
- slow clients are not disconnected,
- GC runs during bursts,
- kernel socket buffers fill.

## Build a Better One — Exercises

1. Add a browser-side latency histogram using `timestamp_ms`.
2. Broadcast to 1,000 synthetic clients and report P99.
3. Compare `send_text(json)` vs `send_bytes(bytes)`.
4. Add topic partitioning by `match_id` and run multiple relay replicas.
5. Implement client subscription filters by match ID.
6. Replace JSON with MessagePack or protobuf and benchmark CPU usage.


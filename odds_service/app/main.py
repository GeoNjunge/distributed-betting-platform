import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.services.connection_manager import ConnectionManager
from app.services.kafka import OddsConsumer


async def kafka_relay_loop(app: FastAPI) -> None:
    consumer: OddsConsumer = app.state.odds_consumer
    manager: ConnectionManager = app.state.connection_manager
    async for payload in consumer.messages():
        # Kafka already stores serialized JSON bytes. Broadcast that same bytes
        # object to every client; do not decode and re-encode on the hot path.
        await manager.broadcast(payload)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.connection_manager = ConnectionManager()
    app.state.odds_consumer = OddsConsumer()
    await app.state.odds_consumer.start()
    relay_task = asyncio.create_task(kafka_relay_loop(app))
    try:
        yield
    finally:
        relay_task.cancel()
        try:
            await relay_task
        except asyncio.CancelledError:
            pass
        await app.state.odds_consumer.stop()


app = FastAPI(title="odds-service", lifespan=lifespan)


@app.websocket("/ws/odds")
async def odds_websocket(websocket: WebSocket) -> None:
    manager: ConnectionManager = websocket.app.state.connection_manager
    client = await manager.connect(websocket)
    try:
        while True:
            # The relay is server-push. Reads are only used to detect client
            # disconnects and allow ping/control messages to flow through ASGI.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(client)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, int | str]:
    manager: ConnectionManager = app.state.connection_manager
    return {"status": "ok", "active_websockets": await manager.size()}

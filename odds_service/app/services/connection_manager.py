import asyncio
from dataclasses import dataclass, field
from typing import Final

from fastapi import WebSocket
from starlette.websockets import WebSocketState


_QUEUE_DEPTH: Final[int] = 256


@dataclass(slots=True, eq=False)
class ClientConnection:
    websocket: WebSocket
    queue: asyncio.Queue[bytes] = field(default_factory=lambda: asyncio.Queue(maxsize=_QUEUE_DEPTH))
    writer_task: asyncio.Task[None] | None = None


class ConnectionManager:
    """Epoll-friendly WebSocket connection manager.

    The manager avoids one blocking broadcast loop that waits on slow clients.
    Each connection owns a small bounded asyncio queue and one writer task. On
    Linux, uvicorn/asyncio multiplexes those sockets through the event loop's
    epoll selector, so idle clients do not consume threads.
    """

    def __init__(self) -> None:
        self._clients: set[ClientConnection] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> ClientConnection:
        await websocket.accept()
        client = ClientConnection(websocket=websocket)
        client.writer_task = asyncio.create_task(self._writer(client))
        async with self._lock:
            self._clients.add(client)
        return client

    async def disconnect(self, client: ClientConnection) -> None:
        async with self._lock:
            self._clients.discard(client)
        if client.writer_task is not None:
            client.writer_task.cancel()
            try:
                await client.writer_task
            except asyncio.CancelledError:
                pass
        if client.websocket.client_state != WebSocketState.DISCONNECTED:
            await client.websocket.close()

    async def broadcast(self, payload: bytes) -> None:
        async with self._lock:
            clients = tuple(self._clients)
        stale: list[ClientConnection] = []
        for client in clients:
            try:
                client.queue.put_nowait(payload)
            except asyncio.QueueFull:
                # A full queue means the socket cannot keep up with the tick
                # rate. Drop the client to protect low-latency subscribers.
                stale.append(client)
        if stale:
            await asyncio.gather(*(self.disconnect(client) for client in stale), return_exceptions=True)

    async def _writer(self, client: ClientConnection) -> None:
        while True:
            payload = await client.queue.get()
            await client.websocket.send_bytes(payload)

    async def size(self) -> int:
        async with self._lock:
            return len(self._clients)

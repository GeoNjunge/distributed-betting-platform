import asyncio
import random
import signal
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from app.config import get_settings
from app.schemas.odds import OddsTick
from app.services.codec import encode_tick
from app.services.kafka import OddsProducer


@dataclass(slots=True)
class SimulatedSelection:
    match_id: str
    market_id: str
    selection_id: str
    odds: Decimal
    sequence: int = 0

    def next_tick(self) -> OddsTick:
        # Small bounded random walk around current odds. Decimal keeps published
        # odds stable and exact to four decimal places.
        drift = Decimal(str(random.uniform(-0.025, 0.025))).quantize(Decimal("0.0001"))
        self.odds = min(Decimal("25.0000"), max(Decimal("1.0100"), self.odds + drift))
        self.sequence += 1
        return OddsTick(
            match_id=self.match_id,
            market_id=self.market_id,
            selection_id=self.selection_id,
            sequence=self.sequence,
            timestamp_ms=int(datetime.now(UTC).timestamp() * 1000),
            decimal_odds=self.odds,
        )


def build_market(match_count: int) -> list[SimulatedSelection]:
    selections: list[SimulatedSelection] = []
    for idx in range(1, match_count + 1):
        match_id = f"match-{idx:04d}"
        selections.extend(
            [
                SimulatedSelection(match_id, "full-time-result", "home", Decimal("2.1000")),
                SimulatedSelection(match_id, "full-time-result", "draw", Decimal("3.4000")),
                SimulatedSelection(match_id, "full-time-result", "away", Decimal("2.9000")),
            ]
        )
    return selections


async def run() -> None:
    settings = get_settings()
    producer = OddsProducer()
    await producer.start()
    stop_event = asyncio.Event()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    selections = build_market(settings.simulator_match_count)
    interval_seconds = settings.simulator_tick_interval_ms / 1000
    try:
        while not stop_event.is_set():
            started = loop.time()
            for selection in selections:
                tick = selection.next_tick()
                payload = encode_tick(tick)
                key = f"{tick.match_id}:{tick.market_id}:{tick.selection_id}".encode("utf-8")
                await producer.publish_tick(topic=settings.odds_updates_topic, key=key, payload=payload)
            elapsed = loop.time() - started
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=max(0.0, interval_seconds - elapsed))
            except asyncio.TimeoutError:
                # Timeout is the normal cadence mechanism between 50ms ticks.
                pass
    finally:
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(run())

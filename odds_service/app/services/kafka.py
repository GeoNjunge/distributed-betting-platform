from collections.abc import AsyncIterator

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from app.config import get_settings


class OddsProducer:
    def __init__(self) -> None:
        self._producer: AIOKafkaProducer | None = None

    async def start(self) -> None:
        settings = get_settings()
        self._producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            acks="all",
            enable_idempotence=True,
        )
        await self._producer.start()

    async def stop(self) -> None:
        if self._producer is not None:
            await self._producer.stop()
            self._producer = None

    async def publish_tick(self, *, topic: str, key: bytes, payload: bytes) -> None:
        if self._producer is None:
            raise RuntimeError("OddsProducer is not started")
        await self._producer.send_and_wait(topic, key=key, value=payload)


class OddsConsumer:
    def __init__(self) -> None:
        self._consumer: AIOKafkaConsumer | None = None

    async def start(self) -> None:
        settings = get_settings()
        self._consumer = AIOKafkaConsumer(
            settings.odds_updates_topic,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=settings.kafka_consumer_group,
            enable_auto_commit=True,
            auto_offset_reset="latest",
        )
        await self._consumer.start()

    async def stop(self) -> None:
        if self._consumer is not None:
            await self._consumer.stop()
            self._consumer = None

    async def messages(self) -> AsyncIterator[bytes]:
        if self._consumer is None:
            raise RuntimeError("OddsConsumer is not started")
        async for message in self._consumer:
            yield message.value

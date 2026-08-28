from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, bets
from app.services.kafka import KafkaPublisher


@asynccontextmanager
async def lifespan(app: FastAPI):
    publisher = KafkaPublisher()
    await publisher.start()
    app.state.kafka_publisher = publisher
    try:
        yield
    finally:
        await publisher.stop()


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(bets.router)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    return {"status": "ok"}

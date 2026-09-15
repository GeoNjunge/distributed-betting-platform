from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import create_all, engine
from app.mpesa import close_mpesa_state, init_mpesa_state
from app.mpesa_routes import router as mpesa_router
from app.settlement import router as settlement_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_mpesa_state(app)
    await create_all()
    try:
        yield
    finally:
        await close_mpesa_state(app)
        await engine.dispose()


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(settlement_router)
app.include_router(mpesa_router)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    return {"status": "ok"}

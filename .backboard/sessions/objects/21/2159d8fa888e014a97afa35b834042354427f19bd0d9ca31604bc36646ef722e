from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


async def create_all() -> None:
    # Helpful for standalone local runs. Production should use Alembic-managed
    # migrations instead of auto-creating schema on every deployment.
    from app import models  # noqa: F401 imported so metadata includes models

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

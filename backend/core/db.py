import asyncpg
from typing import AsyncGenerator
from .config import settings

pool: asyncpg.Pool | None = None

async def init_db_pool():
    global pool
    pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        statement_cache_size=0
    )

async def close_db_pool():
    global pool
    if pool:
        await pool.close()

async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    if pool is None:
        raise RuntimeError("Database pool is not initialized")
    async with pool.acquire() as connection:
        yield connection

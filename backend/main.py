from fastapi import FastAPI
from contextlib import asynccontextmanager
from core.db import init_db_pool, close_db_pool
from routers import health, ingest, retrieve

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the asyncpg connection pool
    await init_db_pool()
    yield
    # Shutdown: Close the connection pool
    await close_db_pool()

app = FastAPI(title="Quasar Backend Service", lifespan=lifespan)

# Include routers
app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(retrieve.router)

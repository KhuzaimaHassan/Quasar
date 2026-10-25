from fastapi import APIRouter, Depends
import asyncpg  # type: ignore[import-untyped]
from core.db import get_db
from core.security import verify_internal_secret
import os

router = APIRouter()

@router.get("/health")
async def health_check():
    revision = os.environ.get("RENDER_GIT_COMMIT")
    return {"status": "ok", **({"revision": revision} if revision else {})}

@router.get("/ping", dependencies=[Depends(verify_internal_secret)])
async def ping_check(db: asyncpg.Connection = Depends(get_db)):
    await db.fetchval("SELECT 1")
    return {"status": "ok", "db": "connected"}

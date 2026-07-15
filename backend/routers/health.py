from fastapi import APIRouter, Depends
import asyncpg
from core.db import get_db
from core.security import verify_internal_secret

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "ok"}

@router.get("/ping", dependencies=[Depends(verify_internal_secret)])
async def ping_check(db: asyncpg.Connection = Depends(get_db)):
    await db.fetchval("SELECT 1")
    return {"status": "ok", "db": "connected"}

from fastapi import Header, HTTPException
from .config import settings

async def verify_internal_secret(x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret")):
    if not x_internal_secret or x_internal_secret != settings.INTERNAL_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing internal secret")
    return True

from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    INTERNAL_SERVICE_SECRET: str
    GOOGLE_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # LangSmith Tracing (#103)
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: Optional[str] = None
    LANGCHAIN_PROJECT: str = "quasar"
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()  # type: ignore

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    INTERNAL_SERVICE_SECRET: str
    GOOGLE_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()

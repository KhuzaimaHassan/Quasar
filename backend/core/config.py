from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    INTERNAL_SERVICE_SECRET: str

    class Config:
        env_file = ".env"

settings = Settings()

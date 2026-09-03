from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://korch:korch@localhost:5432/korchindex"
    # Phase 5: point this at the streaming replica; until then reads fall back to primary.
    database_url_replica: str | None = None
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "https://akorch16.github.io,http://localhost:5173"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

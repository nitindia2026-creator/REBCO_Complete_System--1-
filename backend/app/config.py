import base64, hashlib
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./rebco.db"
    jwt_secret: str = "rebco-default-jwt-secret-replace-in-production-min-32-chars"
    jwt_expire_minutes: int = 60
    field_encryption_key: str = "c8SPAIzE0R445ysB7ObRpDsC4YUGRFE8OHE5Jhy2xF8="
    upload_dir: str = "./private_uploads"
    max_upload_mb: int = 10
    cors_origins: str = "*"
    serve_frontend: bool = True
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def encryption_key(self) -> bytes:
        try:
            key = base64.b64decode(self.field_encryption_key)
            if len(key) == 32:
                return key
        except Exception:
            pass
        if len(self.field_encryption_key.encode()) == 32:
            return self.field_encryption_key.encode()
        return hashlib.sha256(self.field_encryption_key.encode()).digest()

settings = Settings()

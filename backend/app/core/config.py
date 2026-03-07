from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  APP_NAME: str = "SmartSeen API"
  API_V1_STR: str = "/api/v1"
  SECRET_KEY: str = "CHANGE_ME"  # override via env in production
  # Short-lived JWT access tokens; client enforces 30 minutes of inactivity.
  # Keep this comfortably above the idle timeout so active users aren't logged out unexpectedly.
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
  REFRESH_TOKEN_EXPIRE_DAYS: int = 7
  MYSQL_USER: str = "root"
  MYSQL_PASSWORD: str = "password"
  MYSQL_HOST: str = "localhost"
  MYSQL_PORT: int = 3306
  MYSQL_DB: str = "sma"
  SQLALCHEMY_ECHO: bool = False
  # Use SQLite instead of MySQL when True (e.g. when mysqlclient is not installed).
  USE_SQLITE: bool = True
  # Override DB URI (e.g. for tests so app and test client share the same DB).
  DATABASE_URI_OVERRIDE: str | None = None

  # Security: CORS allowed origins (comma-separated). Required when using credentials; "*" is invalid with allow_credentials.
  CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
  # File upload: max receipt size in bytes (default 10 MB), and allowed content types (comma-separated, e.g. "image/jpeg,image/png,application/pdf").
  RECEIPT_MAX_BYTES: int = 10 * 1024 * 1024
  ALLOWED_UPLOAD_CONTENT_TYPES: str = "image/jpeg,image/png,image/gif,image/webp,application/pdf"
  # Directory for uploaded files (avatars, receipts, etc.). Created at startup if missing.
  UPLOAD_DIR: str = "uploads"
  # Max avatar file size (default 2 MB).
  AVATAR_MAX_BYTES: int = 2 * 1024 * 1024

  # Allow extra environment variables (e.g. EMAIL_*) without failing validation.
  model_config = SettingsConfigDict(
    env_file=".env",
    case_sensitive=True,
    extra="ignore",
  )

  @property
  def SQLALCHEMY_DATABASE_URI(self) -> str:
    if self.DATABASE_URI_OVERRIDE:
      return self.DATABASE_URI_OVERRIDE
    if self.USE_SQLITE:
      return "sqlite:///./sma.db"
    return (
      f"mysql+mysqldb://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
      f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
    )


settings = Settings()


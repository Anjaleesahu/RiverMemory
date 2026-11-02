import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'rivermemory.db').as_posix()}")
    if not url.startswith("sqlite:///"):
        return url
    filename = url[len("sqlite:///"):]
    if filename in (":memory:", "") or Path(filename).is_absolute():
        return url
    return f"sqlite:///{(BACKEND_DIR / filename).resolve().as_posix()}"


class Settings:
    DATABASE_URL = _database_url()
    JWT_SECRET = os.getenv("JWT_SECRET", "")
    JWT_ALG = "HS256"
    TOKEN_MINUTES = int(os.getenv("TOKEN_MINUTES", "120"))
    CORS_ORIGINS = [o.strip() for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024


settings = Settings()

SECRET_HELP = ('JWT_SECRET must be configured with at least 32 bytes. Run "python scripts/init_env.py" '
               "or set JWT_SECRET in backend/.env, then restart the server.")


def auth_configured() -> bool:
    return len(settings.JWT_SECRET.encode()) >= 32

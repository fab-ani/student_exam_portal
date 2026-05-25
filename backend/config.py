import os
import sys
from dotenv import load_dotenv

load_dotenv()


def _normalize_db_url(raw: str) -> str:
    # SQLAlchemy maps bare "postgresql://" / "postgres://" to psycopg2.
    # We use psycopg3, so force the +psycopg driver if no driver is set.
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]
    if raw.startswith("postgresql://"):
        return "postgresql+psycopg://" + raw[len("postgresql://") :]
    return raw


def _parse_origins(raw: str):
    raw = (raw or "").strip()
    if raw == "*":
        return "*"
    return [o.strip() for o in raw.split(",") if o.strip()]


def _is_production() -> bool:
    return os.getenv("FLASK_ENV", "development").lower() == "production"


def _resolve_secret_key(production: bool) -> str:
    key = os.getenv("SECRET_KEY", "").strip()
    if production:
        if not key or key == "dev-secret-key" or key == "change-me-in-production":
            print(
                "FATAL: SECRET_KEY must be set to a strong random value in "
                "production (current value is empty or the placeholder).",
                file=sys.stderr,
            )
            sys.exit(1)
        return key
    return key or "dev-secret-key"


def _resolve_database_url(production: bool) -> str:
    raw = os.getenv("DATABASE_URL", "").strip()
    if production:
        if not raw:
            print(
                "FATAL: DATABASE_URL must be set in production.",
                file=sys.stderr,
            )
            sys.exit(1)
        if raw.startswith("sqlite"):
            print(
                "FATAL: DATABASE_URL points at SQLite, which is not safe for "
                "production. Use a managed Postgres URL.",
                file=sys.stderr,
            )
            sys.exit(1)
    if not raw:
        raw = "postgresql://postgres:postgres@localhost:5432/exam_portal"
    return _normalize_db_url(raw)


def _resolve_cors_origins(production: bool):
    raw = os.getenv("CORS_ORIGINS", "")
    parsed = _parse_origins(raw or ("http://localhost:3000" if not production else ""))
    if production:
        if parsed == "*" or not parsed:
            print(
                "FATAL: CORS_ORIGINS must be set to an explicit list of "
                "origins in production (wildcard is rejected).",
                file=sys.stderr,
            )
            sys.exit(1)
    return parsed


PRODUCTION = _is_production()


class Config:
    ENV = "production" if PRODUCTION else "development"
    SECRET_KEY = _resolve_secret_key(PRODUCTION)
    SQLALCHEMY_DATABASE_URI = _resolve_database_url(PRODUCTION)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = _resolve_cors_origins(PRODUCTION)
    PORT = int(os.getenv("PORT", "5000"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import auth_configured, settings
from .db import Base, SessionLocal, engine
from . import models  # noqa: F401  (register tables)
from .routers import analysis, core, imports, insights, rain, ranges, records, reports, water

app = FastAPI(title="RiverMemory API", version="1.0.0",
              description="Historical river water quality and environmental intelligence - Triveni Sangam, Prayagraj")

app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

# Additive only: creates missing tables, never drops or alters existing ones.
Base.metadata.create_all(bind=engine)

for r in (core.router, water.router, rain.router, analysis.router, records.router, imports.router, reports.router,
          ranges.router, insights.router):
    app.include_router(r)


@app.get("/api/health", tags=["health"])
def health():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": "connected" if db_ok else "unreachable",
            "auth_configured": auth_configured(),
            "auth_message": None if auth_configured() else "JWT_SECRET must be configured with at least 32 bytes "
                                                           "(admin login is disabled until then)"}

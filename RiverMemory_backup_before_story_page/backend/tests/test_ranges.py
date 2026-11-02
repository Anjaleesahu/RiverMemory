"""Tests for the Phase 3 min-max range data. Runs after test_api.py and shares its temporary database."""
import os
import tempfile

os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ.setdefault("JWT_SECRET", "t" * 48)

from fastapi.testclient import TestClient  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from scripts.load_phase3_data import load_ranges  # noqa: E402

client = TestClient(app)


def test_load_ranges_is_idempotent_and_honest():
    dated_before = client.get("/api/dashboard").json()["totals"]["water_quality_records"]
    with SessionLocal() as db:
        first = load_ranges(db)
    assert first["imported"] == 24 and first["rejected"] == [] and first["duplicates"] == 0
    with SessionLocal() as db:
        again = load_ranges(db)
    assert again["imported"] == 0 and again["duplicates"] == 24

    r = client.get("/api/water-quality/ranges", params={"year": 2022}).json()
    assert r["total"] == 24 and "not dated" in r["note"]
    assert all(i["min_value"] <= i["max_value"] and i["provenance_verified"] is False for i in r["items"])
    assert {i["station_code"] for i in r["items"]} == {"1046", "1049", "1069"}
    assert client.get("/api/water-quality/ranges", params={"river": "Yamuna"}).json()["total"] == 8
    ph = client.get("/api/water-quality/ranges", params={"parameter": "ph", "river": "Ganga"}).json()["items"]
    assert sorted((i["min_value"], i["max_value"]) for i in ph) == [(7.39, 8.35), (7.43, 8.39)]

    # ranges must never leak into the dated water-quality analysis
    assert client.get("/api/dashboard").json()["totals"]["water_quality_records"] == dated_before

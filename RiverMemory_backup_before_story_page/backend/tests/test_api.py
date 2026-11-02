"""Backend tests. Synthetic rows exist ONLY inside these tests (temporary database); the app ships empty."""
import io
import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["JWT_SECRET"] = "t" * 48

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.auth import hash_password  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def admin_user():
    with SessionLocal() as db:
        db.add(User(username="admin", password_hash=hash_password("correct-horse-battery")))
        db.commit()


def auth():
    r = client.post("/api/auth/login", json={"username": "admin", "password": "correct-horse-battery"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def wq_csv():
    lines = ["date,station,river,latitude,longitude,ph,do,bod,total_coliform"]
    for i in range(24):
        y, m = 2023 + i // 12, i % 12 + 1
        lines.append(f"{y}-{m:02d}-15,Test Ganga Stn,Ganga,25.43,81.88,{7 + (i % 3) * 0.1},{6 - (i % 5) * 0.4},{2 + i % 4},{300 + i * 10}")
        lines.append(f"{y}-{m:02d}-16,Test Yamuna Stn,Yamuna,25.42,81.87,7.4,{5 - (i % 4) * 0.3},{3 + i % 3},BDL")
    lines.append("2023-01-15,Test Ganga Stn,Ganga,25.43,81.88,7,6,2,300")      # duplicate
    lines.append("not-a-date,Test Ganga Stn,Ganga,25.43,81.88,7,6,2,300")      # bad date
    lines.append("2023-05-01,X,Saraswati,25.4,81.8,7,6,2,300")                 # river rejected
    lines.append("2023-05-02,X,Ganga,25.4,81.8,15,6,2,300")                    # pH out of range
    return "\n".join(lines)


def rain_csv():
    lines = ["date,rainfall_mm,location"]
    import calendar
    for i in range(24):
        y, m = 2023 + i // 12, i % 12 + 1
        for d in range(1, calendar.monthrange(y, m)[1] + 1):
            lines.append(f"{y}-{m:02d}-{d:02d},{((d * (i + 3)) % 17) * 0.9 if d % 3 else 0},Prayagraj grid cell")
    return "\n".join(lines)


def test_health_and_empty_state():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["database"] == "connected" and r.json()["auth_configured"]
    cors = client.options("/api/health", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    })
    assert cors.headers["access-control-allow-origin"] == "http://localhost:5173"
    d = client.get("/api/dashboard").json()
    assert d["totals"]["water_quality_records"] == 0 and d["has_data"] is False
    assert client.get("/api/water-quality/series", params={"parameter": "ph"}).json()["points"] == []
    assert client.get("/api/insights/year/2019").json()["has_data"] is False


def test_auth_required_for_writes_and_public_reads():
    assert client.get("/api/incidents").status_code == 200
    assert client.post("/api/incidents", json={}).status_code == 401
    assert client.post("/api/import/preview").status_code == 401
    assert client.post("/api/data-sources", json={"name": "Unauthorized source"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    assert client.delete("/api/incidents/1", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_import_preview_commit_and_duplicates():
    h = auth()
    files = {"file": ("wq.csv", io.BytesIO(wq_csv().encode()), "text/csv")}
    p = client.post("/api/import/preview", data={"kind": "water_quality"}, files=files, headers=h).json()
    assert p["valid_rows"] == 48 and p["duplicate_rows"] == 1 and p["rejected_rows"] == 3
    assert not p["committed"]
    assert client.get("/api/dashboard").json()["totals"]["water_quality_records"] == 0  # preview saves nothing
    files = {"file": ("wq.csv", io.BytesIO(wq_csv().encode()), "text/csv")}
    c = client.post("/api/import/commit", data={"kind": "water_quality"}, files=files, headers=h)
    assert c.status_code == 201 and c.json()["valid_rows"] == 48
    files = {"file": ("wq.csv", io.BytesIO(wq_csv().encode()), "text/csv")}
    again = client.post("/api/import/commit", data={"kind": "water_quality"}, files=files, headers=h).json()
    assert again["valid_rows"] == 0 and again["duplicate_rows"] == 49  # no duplicate imports
    files = {"file": ("rain.csv", io.BytesIO(rain_csv().encode()), "text/csv")}
    r = client.post("/api/import/commit", data={"kind": "rainfall", "rainfall_kind": "gridded",
                                                 "resolution": "0.25 deg"}, files=files, headers=h)
    assert r.status_code == 201 and r.json()["valid_rows"] > 700


def test_upload_validation():
    h = auth()
    r = client.post("/api/import/preview", data={"kind": "water_quality"},
                    files={"file": ("x.txt", io.BytesIO(b"a,b"), "text/plain")}, headers=h)
    assert r.status_code == 415
    r = client.post("/api/import/preview", data={"kind": "water_quality"},
                    files={"file": ("x.csv", io.BytesIO(b"foo,bar\n1,2"), "text/csv")}, headers=h)
    assert r.status_code == 422


def test_dashboard_water_and_missing_data():
    d = client.get("/api/dashboard").json()
    assert d["totals"]["water_quality_records"] == 48 and d["totals"]["monitoring_locations"] == 2
    assert len(d["latest_observations"]) == 2
    s = client.get("/api/water-quality/summary", params={"river": "Ganga"}).json()
    ph = next(p for p in s["parameters"] if p["parameter"] == "ph")
    assert ph["n"] == 24 and ph["criteria"]["pct_within"] == 100.0
    tc = next(p for p in client.get("/api/water-quality/summary", params={"river": "Yamuna"}).json()["parameters"]
              if p["parameter"] == "total_coliform_mpn")
    assert tc["n"] == 0 and tc["missing"] == 24  # BDL kept as missing, not invented
    ser = client.get("/api/water-quality/series", params={"parameter": "do_mg_l", "agg": "monthly"}).json()
    assert set(ser["groups"]) == {"Ganga", "Yamuna"}
    assert client.get("/api/water-quality/series", params={"parameter": "nope"}).status_code == 422


def test_rainfall_endpoints():
    a = client.get("/api/rainfall/aggregate", params={"period": "monthly"}).json()
    assert len(a["points"]) == 24 and all(p["complete"] for p in a["points"])
    s = client.get("/api/rainfall/summary").json()
    assert s["missing_days_in_range"] == 0 and "gridded" in s["kinds_present"]


def test_comparison_and_correlation():
    c = client.get("/api/comparison", params={"parameter": "ph"}).json()
    assert c["overlapping_periods"] == 24
    r = client.get("/api/analysis/correlation").json()
    assert r["months_paired"] == 24
    do = next(p for p in r["pairs"] if p["parameter"] == "do_mg_l")
    assert do["status"] == "ok" and do["n"] == 24 and "causation" in r["note"].lower()
    # constant series must not yield a coefficient
    ph_y = client.get("/api/analysis/correlation", params={"river": "Yamuna"}).json()
    assert next(p for p in ph_y["pairs"] if p["parameter"] == "ph")["status"] == "insufficient_data"
    # narrow date range -> insufficient data, never a fabricated number
    short = client.get("/api/analysis/correlation", params={"from": "2023-01-01", "to": "2023-05-31"}).json()
    assert all(p["status"] == "insufficient_data" for p in short["pairs"])
    assert client.get("/api/analysis/outliers", params={"parameter": "ph"}).status_code == 200


def test_incident_crud():
    h = auth()
    body = {"title": "Reported discolouration", "incident_date": "2024-03-01", "river": "Yamuna",
            "incident_type": "Visible discolouration", "severity": "moderate", "latitude": 25.4, "longitude": 81.8}
    r = client.post("/api/incidents", json=body, headers=h)
    assert r.status_code == 201
    iid = r.json()["id"]
    assert client.get(f"/api/incidents/{iid}").status_code == 200
    body["title"] = "Updated title"
    assert client.put(f"/api/incidents/{iid}", json=body, headers=h).json()["title"] == "Updated title"
    assert client.get("/api/incidents", params={"q": "Updated"}).json()["total"] == 1
    bad = dict(body, latitude=95.0)
    assert client.post("/api/incidents", json=bad, headers=h).status_code == 422
    assert client.delete(f"/api/incidents/{iid}", headers=h).status_code == 204
    assert client.get(f"/api/incidents/{iid}").status_code == 404


def test_sources_and_reports():
    h = auth()
    s = client.post("/api/data-sources", json={"name": "Test source", "organization": "Test"}, headers=h)
    assert s.status_code == 201 and s.json()["provenance_verified"] is False
    assert any(x["name"] == "Test source" for x in client.get("/api/data-sources").json())
    assert client.get("/api/reports/water-quality", params={"format": "csv", "river": "Ganga"}).text.count("\n") == 25
    assert client.get("/api/reports/water-quality", params={"format": "xlsx"}).content[:2] == b"PK"
    assert client.get("/api/reports/rainfall", params={"format": "pdf"}).content[:4] == b"%PDF"
    assert client.get("/api/reports/bogus").status_code == 404


def test_locations_and_timeline():
    locs = client.get("/api/locations").json()
    assert len(locs) == 2 and all(l["record_count"] == 24 for l in locs)
    t = client.get("/api/timeline", params={"parameter": "do_mg_l"}).json()
    assert len(t["months"]) == 24

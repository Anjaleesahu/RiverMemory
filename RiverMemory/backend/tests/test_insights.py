from pathlib import Path

import pytest
import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app
from app.models import DataSource, Rainfall, RainfallReferencePoint, Station, WaterQualityRange
from scripts.load_phase3_data import load_phase3_data, load_rainfall, load_reference_points

WORKBOOK = Path(__file__).resolve().parents[2] / "data" / "RiverMemory_Phase3_Cleaned_Dataset.xlsx"


@pytest.fixture
def isolated_db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'insights.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = test_sessions()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield test_sessions
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_year_insights_imports_real_data_idempotently_and_keeps_ranges_separate(isolated_db):
    with isolated_db() as db:
        result = load_phase3_data(db, WORKBOOK)
    assert result["ranges"]["imported"] == 24
    assert result["rainfall"]["imported"] == 365
    assert result["reference_points"] == 2

    with isolated_db() as db:
        rainfall_count = db.scalar(select(func.count(Rainfall.id)))
        range_count = db.scalar(select(func.count(WaterQualityRange.id)))
        stored_rainfall = db.scalars(
            select(Rainfall).where(Rainfall.kind == "gridded").order_by(Rainfall.date)
        ).all()
        stations = db.scalars(select(Station).where(Station.name.like("%Prayagraj%"))).all()
        assert rainfall_count == 365
        assert range_count == 24
        expected = pd.read_excel(WORKBOOK, sheet_name="Rainfall_Clean")
        assert all(
            stored.rainfall_mm == float(source)
            for stored, source in zip(stored_rainfall, expected["Rainfall_mm"])
        )
        conductivity = db.scalar(
            select(WaterQualityRange).where(WaterQualityRange.parameter == "conductivity_us_cm")
        )
        assert conductivity.unit == "µS/cm"
        assert conductivity.unit_original == "µmhos/cm"
        cpcb_source = db.get(DataSource, conductivity.source_id)
        assert cpcb_source.provenance_verified is False
        assert cpcb_source.period_start is None and cpcb_source.period_end is None
        assert "NO3 vs N" in cpcb_source.missing_info
        assert all(station.latitude is None and station.longitude is None for station in stations)
        assert db.scalar(select(func.count(RainfallReferencePoint.code))) == 2

        repeated_rainfall = load_rainfall(db, workbook_path=WORKBOOK)
        repeated_points = load_reference_points(db, WORKBOOK)
        assert repeated_rainfall["imported"] == 0
        assert repeated_rainfall["duplicates"] == 365
        assert repeated_points == 2
        assert db.scalar(select(func.count(Rainfall.id))) == 365
        assert db.scalar(select(func.count(RainfallReferencePoint.code))) == 2

    response = TestClient(app).get("/api/insights/year/2022")
    assert response.status_code == 200
    data = response.json()
    assert data["highlights"]["total_rainfall_mm"] == 560.77
    assert data["highlights"]["rainy_days_ge_2_5mm"] == 47
    assert data["highlights"]["wet_days_gt_0mm"] == 66
    assert data["highlights"]["monsoon_share_percent"] == 83.0
    assert data["highlights"]["wettest_month"]["label"] == "July"
    assert data["highlights"]["wettest_month"]["rainfall_mm"] == 166.4
    assert data["highlights"]["longest_dry_spell"] == {
        "days": 120,
        "from": "2022-01-24",
        "to": "2022-05-23",
    }
    assert data["highlights"]["wettest_day"] == {
        "date": "2022-07-25",
        "rainfall_mm": 51.34,
    }
    assert len(data["ranges"]) == 24
    assert len(data["rainfall"]["calendar"]) == 12
    assert all(len(month["days"]) == 31 for month in data["rainfall"]["calendar"])
    assert {point["code"] for point in data["reference_points"]} == {"RF-TARGET", "RF-GRID"}
    assert all(point["point_type"].startswith("Rainfall reference point") for point in data["reference_points"])
    assert all(
        row["screening"]["status"] == "outside"
        for row in data["ranges"]
        if row["parameter"] == "total_coliform_mpn"
    )
    assert all(
        row["screening"] is None
        for row in data["ranges"]
        if row["parameter"] in {"nitrate_mg_l", "fecal_coliform_mpn"}
    )


def test_insights_empty_year_has_no_fabricated_rainfall_values(isolated_db):
    response = TestClient(app).get("/api/insights/year/2019")
    assert response.status_code == 200
    data = response.json()
    assert data["has_data"] is False
    assert data["rainfall"]["daily"] == []
    assert data["rainfall"]["monthly"] == []
    assert data["highlights"]["total_rainfall_mm"] is None
    assert data["highlights"]["wettest_day"] is None

"""Idempotently load the cleaned Phase 3 workbook into additive database tables.

Run from backend/: python -m scripts.load_phase3_data
"""
import argparse
import sys
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models  # noqa: F401
from app.db import Base, SessionLocal, engine
from app.models import (
    DataSource,
    ImportBatch,
    Rainfall,
    RainfallReferencePoint,
    Station,
    WaterQualityRange,
)
from app.params import PARAMS, RIVER_NORMALIZE

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATASET_XLSX = DATA_DIR / "RiverMemory_Phase3_Cleaned_Dataset.xlsx"
RANGES_CSV = DATA_DIR / "water_quality_ranges_2022.csv"
RAINFALL_CSV = DATA_DIR / "rainfall_prayagraj_2022.csv"

PARAMETER_KEYS = {
    "temperature": "temperature_c",
    "dissolved oxygen": "do_mg_l",
    "ph": "ph",
    "conductivity": "conductivity_us_cm",
    "biochemical oxygen demand": "bod_mg_l",
    "nitrate": "nitrate_mg_l",
    "fecal coliform": "fecal_coliform_mpn",
    "total coliform": "total_coliform_mpn",
}

IMD_SOURCE = dict(
    name="IMD gridded daily rainfall (RF25), 2022 - Prayagraj grid cell",
    organization="India Meteorological Department (IMD)",
    period_start=date(2022, 1, 1),
    period_end=date(2022, 12, 31),
    parameters="Daily rainfall",
    units="mm",
    coverage=(
        "Nearest IMD 0.25 degree grid cell (25.5 N, 81.75 E). Rainfall reference points "
        "RF-TARGET (25.4358, 81.8463) and RF-GRID (25.5, 81.75) are stored separately "
        "from water-quality monitoring stations."
    ),
    data_format="Cleaned Excel workbook; daily gridded rainfall",
    processing="Loaded the 365 supplied daily values without rounding, interpolation or imputation.",
    missing_info="None in the supplied 2022 series. Original download URL was not recorded.",
    limitations=(
        "Nearest 0.25 degree grid-cell estimate, not a rain-gauge observation or district-wide average. "
        "Provenance remains unverified."
    ),
    provenance_verified=False,
)

CPCB_SOURCE = dict(
    name="CPCB water quality 2022 - annual min-max table (user-supplied)",
    organization="Central Pollution Control Board (CPCB)",
    period_start=None,
    period_end=None,
    parameters="Temperature, DO, pH, conductivity, BOD, nitrate, fecal coliform, total coliform",
    units="°C, mg/L, pH units, µS/cm, MPN/100 mL; conductivity source unit: µmhos/cm",
    coverage=(
        "2022 source-table ranges for stations 1046 and 1049 (Ganga) and 1069 (Yamuna), Prayagraj. "
        "The period covered by each min-max range is not stated."
    ),
    data_format="Cleaned Excel workbook; annual minimum-maximum ranges",
    processing=(
        "Stored the supplied minimum and maximum values as annual ranges. Conductivity is displayed as µS/cm "
        "(source unit µmhos/cm); no measurement values were converted."
    ),
    missing_info=(
        "Exact CPCB report title, page and period covered by the ranges remain unconfirmed. "
        "The nitrate basis (NO3 vs N) is not stated. Water-quality station coordinates are absent."
    ),
    limitations=(
        "Annual min-max ranges are not dated readings and are excluded from time series, daily statistics, "
        "trends and rainfall correlations. Provenance remains unverified."
    ),
    provenance_verified=False,
)

DISPLAY_UNITS = {
    "temperature_c": ("°C", "°C"),
    "conductivity_us_cm": ("µS/cm", "µmhos/cm"),
}


def _source(db: Session, spec: dict) -> DataSource:
    row = db.scalar(select(DataSource).where(DataSource.name == spec["name"]))
    if row is None:
        row = DataSource(**spec)
        db.add(row)
        db.flush()
        return row
    for key, value in spec.items():
        if key != "provenance_verified":
            setattr(row, key, value)
    return row


def _text(value) -> str:
    return "" if value is None or pd.isna(value) else str(value).strip()


def _range_records(workbook_path: Path, csv_path: Path | None) -> list[dict]:
    if workbook_path.exists():
        df = pd.read_excel(workbook_path, sheet_name="Water_Quality_Clean", dtype={"Station_ID": str})
        rows = []
        for r in df.to_dict("records"):
            parameter = PARAMETER_KEYS.get(_text(r["Parameter"]).casefold())
            unit, original = DISPLAY_UNITS.get(
                parameter,
                (_text(r["Unit"]), _text(r["Unit_Original"])),
            )
            rows.append(
                {
                    "record_id": _text(r["Record_ID"]),
                    "year": int(r["Year"]),
                    "river": _text(r["River"]),
                    "station_code": _text(r["Station_ID"]),
                    "station": _text(r["Station_Name"]),
                    "parameter": parameter,
                    "min_value": float(r["Min_Value"]),
                    "max_value": float(r["Max_Value"]),
                    "unit": unit,
                    "unit_original": original,
                    "value_type": "min_max_range",
                    "source_status": "Unverified - exact CPCB report, page and date range to confirm",
                }
            )
        return rows
    if csv_path is None or not csv_path.exists():
        raise FileNotFoundError(f"Cleaned workbook not found: {workbook_path}")
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    rows = []
    for r in df.to_dict("records"):
        parameter = r["parameter"].strip()
        unit, original = DISPLAY_UNITS.get(parameter, (r["unit"].strip(), r["unit_original"].strip()))
        rows.append(
            {
                "record_id": r["record_id"].strip(),
                "year": int(r["year"]),
                "river": r["river"].strip(),
                "station_code": r["station_code"].strip(),
                "station": r["station"].strip(),
                "parameter": parameter,
                "min_value": float(r["min_value"]),
                "max_value": float(r["max_value"]),
                "unit": unit,
                "unit_original": original,
                "value_type": "min_max_range",
                "source_status": "Unverified - exact CPCB report, page and date range to confirm",
            }
        )
    return rows


def load_ranges(
    db: Session,
    csv_path: Path | None = None,
    workbook_path: Path = DATASET_XLSX,
) -> dict:
    source = _source(db, CPCB_SOURCE)
    _source(db, IMD_SOURCE)
    stations = {(s.name.casefold(), s.river): s for s in db.scalars(select(Station)).all()}
    existing = {
        (r.station_id, r.year, r.parameter): r
        for r in db.scalars(select(WaterQualityRange)).all()
    }
    new_rows, rejected, duplicates = [], [], 0
    records = _range_records(workbook_path, csv_path)

    for index, row in enumerate(records, start=2):
        river = RIVER_NORMALIZE.get(row["river"].casefold())
        parameter = row["parameter"]
        if not river or parameter not in PARAMS or not row["station"]:
            rejected.append((index, "unknown river, parameter or empty station"))
            continue
        lo, hi = row["min_value"], row["max_value"]
        p_lo, p_hi = PARAMS[parameter]["range"]
        if lo > hi or not (p_lo <= lo and hi <= p_hi):
            rejected.append((index, f"{parameter} has an invalid or implausible min-max range"))
            continue

        station_key = (row["station"].casefold(), river)
        station = stations.get(station_key)
        if station is None:
            station = Station(
                name=row["station"],
                river=river,
                latitude=None,
                longitude=None,
                source_id=source.id,
            )
            db.add(station)
            db.flush()
            stations[station_key] = station

        key = (station.id, row["year"], parameter)
        current = existing.get(key)
        if current:
            current.station_code = row["station_code"] or None
            current.unit = row["unit"]
            current.unit_original = row["unit_original"] or None
            current.value_type = row["value_type"]
            current.source_status = row["source_status"]
            current.record_ref = row["record_id"] or None
            current.source_id = source.id
            duplicates += 1
            continue
        existing[key] = None
        new_rows.append((station, row, river))

    batch = None
    if new_rows:
        batch = ImportBatch(
            kind="water_quality_ranges",
            filename=workbook_path.name if workbook_path.exists() else Path(csv_path).name,
            source_id=source.id,
            rows_total=len(records),
            rows_imported=len(new_rows),
            rows_duplicate=duplicates,
            rows_rejected=len(rejected),
            imported_by="load_phase3_data",
        )
        db.add(batch)
        db.flush()
        for station, row, _river in new_rows:
            db.add(
                WaterQualityRange(
                    station_id=station.id,
                    station_code=row["station_code"] or None,
                    year=row["year"],
                    parameter=row["parameter"],
                    min_value=row["min_value"],
                    max_value=row["max_value"],
                    unit=row["unit"],
                    unit_original=row["unit_original"] or None,
                    value_type=row["value_type"],
                    source_status=row["source_status"],
                    record_ref=row["record_id"] or None,
                    source_id=source.id,
                    batch_id=batch.id,
                )
            )
    db.commit()
    return {
        "total": len(records),
        "imported": len(new_rows),
        "duplicates": duplicates,
        "rejected": rejected,
        "cpcb_source_id": source.id,
    }


def _rainfall_records(workbook_path: Path, csv_path: Path | None) -> list[dict]:
    if workbook_path.exists():
        df = pd.read_excel(workbook_path, sheet_name="Rainfall_Clean")
        return [
            {
                "date": pd.to_datetime(r["Date"]).date(),
                "location": _text(r["Location"]),
                "rainfall_mm": float(r["Rainfall_mm"]),
                "kind": "gridded",
                "resolution": "0.25 x 0.25 degrees",
            }
            for r in df.to_dict("records")
        ]
    if csv_path is None or not csv_path.exists():
        raise FileNotFoundError(f"Cleaned workbook not found: {workbook_path}")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    return [
        {
            "date": pd.to_datetime(r["date"]).date(),
            "location": str(r["location"]),
            "rainfall_mm": float(r["rainfall_mm"]),
            "kind": "gridded",
            "resolution": str(r["resolution"]),
        }
        for r in df.to_dict("records")
    ]


def load_rainfall(
    db: Session,
    csv_path: Path | None = None,
    workbook_path: Path = DATASET_XLSX,
) -> dict:
    source = _source(db, IMD_SOURCE)
    records = _rainfall_records(workbook_path, csv_path)
    existing = {
        (d, location.casefold(), kind)
        for d, location, kind in db.execute(select(Rainfall.date, Rainfall.location, Rainfall.kind))
    }
    new_rows = []
    duplicates = 0
    for row in records:
        key = (row["date"], row["location"].casefold(), row["kind"])
        if key in existing:
            duplicates += 1
            continue
        existing.add(key)
        new_rows.append(row)

    batch = None
    if new_rows:
        batch = ImportBatch(
            kind="rainfall",
            filename=workbook_path.name if workbook_path.exists() else Path(csv_path).name,
            source_id=source.id,
            rows_total=len(records),
            rows_imported=len(new_rows),
            rows_duplicate=duplicates,
            rows_rejected=0,
            imported_by="load_phase3_data",
        )
        db.add(batch)
        db.flush()
        db.add_all(
            [Rainfall(**row, source_id=source.id, batch_id=batch.id) for row in new_rows]
        )
    db.commit()
    return {
        "total": len(records),
        "imported": len(new_rows),
        "duplicates": duplicates,
        "source_id": source.id,
    }


def load_reference_points(db: Session, workbook_path: Path = DATASET_XLSX) -> int:
    if not workbook_path.exists():
        return 0
    source = _source(db, IMD_SOURCE)
    df = pd.read_excel(workbook_path, sheet_name="Station_Coordinates")
    count = 0
    for row in df.to_dict("records"):
        code = _text(row["Station_ID"])
        point_type = _text(row["Point_Type"])
        if not code.startswith("RF-") or "rainfall reference point" not in point_type.casefold():
            continue
        current = db.get(RainfallReferencePoint, code)
        values = {
            "name": _text(row["Station_Name"]),
            "latitude": float(row["Latitude"]),
            "longitude": float(row["Longitude"]),
            "point_type": point_type,
            "note": _text(row["Action_Required"]),
            "source_id": source.id,
        }
        if current is None:
            db.add(RainfallReferencePoint(code=code, **values))
        else:
            for key, value in values.items():
                setattr(current, key, value)
        count += 1
    db.commit()
    return count


def load_phase3_data(
    db: Session,
    workbook_path: Path = DATASET_XLSX,
    ranges_csv: Path | None = RANGES_CSV,
    rainfall_csv: Path | None = RAINFALL_CSV,
) -> dict:
    ranges = load_ranges(db, ranges_csv, workbook_path)
    rainfall = load_rainfall(db, rainfall_csv, workbook_path)
    reference_points = load_reference_points(db, workbook_path)
    return {
        "ranges": ranges,
        "rainfall": rainfall,
        "reference_points": reference_points,
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, default=DATASET_XLSX)
    parser.add_argument("--ranges-csv", type=Path, default=RANGES_CSV)
    parser.add_argument("--rainfall-csv", type=Path, default=RAINFALL_CSV)
    args = parser.parse_args(argv)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        result = load_phase3_data(db, args.workbook, args.ranges_csv, args.rainfall_csv)
    ranges = result["ranges"]
    rainfall = result["rainfall"]
    print(
        f"Water-quality ranges: {ranges['imported']} imported, "
        f"{ranges['duplicates']} already present, {len(ranges['rejected'])} rejected."
    )
    print(
        f"Rainfall: {rainfall['imported']} imported, {rainfall['duplicates']} already present "
        f"(of {rainfall['total']}); reference points: {result['reference_points']}."
    )
    return 1 if ranges["rejected"] else 0


if __name__ == "__main__":
    sys.exit(main())

import calendar
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import DataSource, Rainfall, RainfallReferencePoint, Station, WaterQualityRange
from ..params import BATHING_CRITERIA, PARAMS

router = APIRouter(prefix="/api/insights", tags=["insights"])

REVIEW_PARAMETERS = (
    "temperature_c",
    "ph",
    "do_mg_l",
    "bod_mg_l",
    "conductivity_us_cm",
    "nitrate_mg_l",
    "fecal_coliform_mpn",
    "total_coliform_mpn",
)
MONSOON_MONTHS = {6, 7, 8, 9}


def _round(value: float | None, digits: int = 2):
    return round(value, digits) if value is not None else None


def _longest_dry_spell(daily: list[dict]) -> dict | None:
    longest = None
    current_start = None
    current_end = None
    current_length = 0
    for row in daily:
        if row["rainfall_mm"] == 0:
            if current_start is None:
                current_start = row["date"]
            current_end = row["date"]
            current_length += 1
            continue
        if current_length and (longest is None or current_length > longest["days"]):
            longest = {"days": current_length, "from": current_start, "to": current_end}
        current_start = None
        current_end = None
        current_length = 0
    if current_length and (longest is None or current_length > longest["days"]):
        longest = {"days": current_length, "from": current_start, "to": current_end}
    return longest


@router.get("/year/{year}")
def year_in_review(year: int, db: Session = Depends(get_db)):
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    expected_days = (year_end - year_start).days + 1

    rainfall_rows = db.scalars(
        select(Rainfall)
        .where(
            Rainfall.date >= year_start,
            Rainfall.date <= year_end,
            Rainfall.kind == "gridded",
        )
        .order_by(Rainfall.date, Rainfall.id)
    ).all()
    by_day: dict[date, list[float]] = {}
    locations = set()
    for row in rainfall_rows:
        if row.rainfall_mm is not None:
            by_day.setdefault(row.date, []).append(float(row.rainfall_mm))
            locations.add(row.location)

    daily = []
    for offset in range(expected_days):
        current = year_start + timedelta(days=offset)
        values = by_day.get(current, [])
        daily.append(
            {
                "date": current.isoformat(),
                "rainfall_mm": sum(values) / len(values) if values else None,
                "locations_count": len(values),
            }
        )
    observed = [row for row in daily if row["rainfall_mm"] is not None]
    monthly_totals = [0.0] * 12
    monthly_days = [0] * 12
    cumulative = 0.0
    cumulative_started = False
    cumulative_series = []
    for row in daily:
        current = date.fromisoformat(row["date"])
        rainfall_mm = row["rainfall_mm"]
        if rainfall_mm is not None:
            monthly_totals[current.month - 1] += rainfall_mm
            monthly_days[current.month - 1] += 1
            cumulative += rainfall_mm
            cumulative_started = True
        cumulative_series.append(
            {
                "date": row["date"],
                "cumulative_mm": _round(cumulative, 3) if cumulative_started else None,
                "monsoon": current.month in MONSOON_MONTHS,
            }
        )

    monthly = [
        {
            "month": month,
            "label": calendar.month_abbr[month],
            "rainfall_mm": _round(monthly_totals[month - 1]) if monthly_days[month - 1] else None,
            "days_with_data": monthly_days[month - 1],
            "days_expected": calendar.monthrange(year, month)[1],
        }
        for month in range(1, 13)
    ]
    total_mm = sum(row["rainfall_mm"] for row in observed) if observed else None
    rainy_days = sum(row["rainfall_mm"] >= 2.5 for row in observed)
    wet_days = sum(row["rainfall_mm"] > 0 for row in observed)
    monsoon_total = sum(
        row["rainfall_mm"]
        for row in observed
        if date.fromisoformat(row["date"]).month in MONSOON_MONTHS
    )
    wettest_day = max(observed, key=lambda row: row["rainfall_mm"]) if observed else None
    populated_months = [row for row in monthly if row["days_with_data"]]
    wettest_month = max(populated_months, key=lambda row: row["rainfall_mm"]) if populated_months else None

    calendar_rows = []
    for month in range(1, 13):
        days_in_month = calendar.monthrange(year, month)[1]
        cells = []
        for day in range(1, 32):
            if day > days_in_month:
                cells.append(None)
                continue
            current = date(year, month, day)
            cells.append(
                {
                    "date": current.isoformat(),
                    "rainfall_mm": daily[(current - year_start).days]["rainfall_mm"],
                }
            )
        calendar_rows.append({"month": month, "label": calendar.month_abbr[month], "days": cells})

    range_rows = db.execute(
        select(WaterQualityRange, Station, DataSource)
        .join(Station, WaterQualityRange.station_id == Station.id)
        .outerjoin(DataSource, WaterQualityRange.source_id == DataSource.id)
        .where(
            WaterQualityRange.year == year,
            WaterQualityRange.parameter.in_(REVIEW_PARAMETERS),
        )
        .order_by(Station.river, Station.name, WaterQualityRange.parameter)
    ).all()
    range_items = []
    for record, station, source in range_rows:
        criteria = BATHING_CRITERIA["limits"].get(record.parameter)
        violations = []
        if criteria:
            if "min" in criteria and record.min_value < criteria["min"]:
                violations.append(f"minimum below {criteria['min']}")
            if "max" in criteria and record.max_value > criteria["max"]:
                violations.append(f"maximum above {criteria['max']}")
        range_items.append(
            {
                "id": record.id,
                "record_ref": record.record_ref,
                "year": record.year,
                "station": station.name,
                "station_code": record.station_code,
                "station_id": station.id,
                "river": station.river,
                "parameter": record.parameter,
                "label": PARAMS[record.parameter]["label"],
                "unit": record.unit,
                "min_value": record.min_value,
                "max_value": record.max_value,
                "range_width": record.max_value - record.min_value,
                "criteria": criteria,
                "screening": (
                    {"status": "outside", "reasons": violations}
                    if violations
                    else {"status": "within", "reasons": []} if criteria else None
                ),
                "source": source.name if source else None,
                "provenance_verified": bool(source.provenance_verified) if source else False,
            }
        )

    reference_points = [
        {
            "code": point.code,
            "name": point.name,
            "latitude": point.latitude,
            "longitude": point.longitude,
            "point_type": point.point_type,
        }
        for point in db.scalars(
            select(RainfallReferencePoint).order_by(RainfallReferencePoint.code)
        ).all()
    ]
    return {
        "year": year,
        "has_rainfall": bool(observed),
        "has_ranges": bool(range_items),
        "has_data": bool(observed or range_items),
        "rainfall": {
            "kind": "gridded",
            "locations": sorted(locations),
            "days_with_data": len(observed),
            "days_expected": expected_days,
            "daily": daily if observed else [],
            "calendar": calendar_rows if observed else [],
            "monthly": monthly if observed else [],
            "cumulative": cumulative_series if observed else [],
        },
        "highlights": {
            "total_rainfall_mm": _round(total_mm),
            "rainy_days_ge_2_5mm": rainy_days if observed else None,
            "wet_days_gt_0mm": wet_days if observed else None,
            "monsoon_share_percent": (
                _round(100 * monsoon_total / total_mm, 1)
                if total_mm is not None and total_mm > 0
                else None
            ),
            "monsoon_rainfall_mm": _round(monsoon_total) if observed else None,
            "wettest_month": (
                {
                    "month": wettest_month["month"],
                    "label": calendar.month_name[wettest_month["month"]],
                    "rainfall_mm": wettest_month["rainfall_mm"],
                    "days_with_data": wettest_month["days_with_data"],
                }
                if wettest_month
                else None
            ),
            "longest_dry_spell": _longest_dry_spell(daily) if observed else None,
            "wettest_day": (
                {
                    "date": wettest_day["date"],
                    "rainfall_mm": _round(wettest_day["rainfall_mm"]),
                }
                if wettest_day
                else None
            ),
        },
        "ranges": range_items,
        "range_parameters": list(REVIEW_PARAMETERS),
        "screening": {
            "name": BATHING_CRITERIA["name"],
            "limits": BATHING_CRITERIA["limits"],
            "note": BATHING_CRITERIA["applicability"],
        },
        "reference_points": reference_points,
        "caveats": [
            "Annual water-quality min-max ranges have no dates and are not readings.",
            "Rainfall is a gridded estimate, not a rain-gauge observation.",
            "CPCB provenance is unverified until the original report, page and period are confirmed.",
            "CPCB Class B screening is indicative and is not a drinking-water safety claim.",
            "Side-by-side display does not imply rainfall caused any water-quality change.",
        ],
    }

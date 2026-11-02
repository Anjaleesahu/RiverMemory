"""Annual min-max water-quality ranges (not dated readings)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import DataSource, Station, WaterQualityRange
from ..params import PARAMS

router = APIRouter(prefix="/api/water-quality", tags=["water-quality"])

RANGE_NOTE = ("Each row is one minimum and one maximum for the stated year. These are not dated or daily readings, "
              "so they are excluded from trends, correlations and rainfall comparisons. The period covered by each "
              "range and the exact source report are unverified unless the data source says otherwise.")


@router.get("/ranges")
def ranges(river: str | None = None, station_id: int | None = None, year: int | None = None,
           parameter: str | None = None, db: Session = Depends(get_db)):
    q = (select(WaterQualityRange, Station, DataSource)
         .join(Station, WaterQualityRange.station_id == Station.id)
         .outerjoin(DataSource, WaterQualityRange.source_id == DataSource.id))
    if river:
        q = q.where(Station.river == river)
    if station_id:
        q = q.where(Station.id == station_id)
    if year:
        q = q.where(WaterQualityRange.year == year)
    if parameter:
        q = q.where(WaterQualityRange.parameter == parameter)
    q = q.order_by(WaterQualityRange.year, Station.river, Station.name, WaterQualityRange.id)
    items = []
    for r, st, src in db.execute(q).all():
        meta = PARAMS.get(r.parameter, {})
        items.append({
            "id": r.id, "record_ref": r.record_ref, "year": r.year, "river": st.river, "station": st.name,
            "station_id": st.id, "station_code": r.station_code, "parameter": r.parameter,
            "label": meta.get("label", r.parameter), "unit": r.unit, "unit_original": r.unit_original,
            "min_value": r.min_value, "max_value": r.max_value,
            "range_width": round(r.max_value - r.min_value, 6), "value_type": r.value_type,
            "source_status": r.source_status, "source": src.name if src else None,
            "provenance_verified": bool(src.provenance_verified) if src else False,
        })
    return {"total": len(items), "items": items, "note": RANGE_NOTE}

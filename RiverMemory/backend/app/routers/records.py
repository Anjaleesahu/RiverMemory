from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..db import get_db
from ..models import DataSource, Incident, User
from ..schemas import DataSourceIn, DataSourceOut, IncidentIn, IncidentOut

router = APIRouter(prefix="/api", tags=["records"])


@router.get("/incidents")
def list_incidents(river: str | None = None, incident_type: str | None = None, severity: str | None = None,
                   q: str | None = Query(None, max_length=100),
                   d_from: date | None = Query(None, alias="from"), d_to: date | None = Query(None, alias="to"),
                   page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
                   order: str = Query("desc", pattern="^(asc|desc)$"), db: Session = Depends(get_db)):
    cond = []
    if river:
        cond.append(Incident.river == river)
    if incident_type:
        cond.append(Incident.incident_type == incident_type)
    if severity:
        cond.append(Incident.severity == severity)
    if d_from:
        cond.append(Incident.incident_date >= d_from)
    if d_to:
        cond.append(Incident.incident_date <= d_to)
    if q:
        like = f"%{q}%"
        cond.append(or_(Incident.title.ilike(like), Incident.description.ilike(like), Incident.location.ilike(like)))
    total = db.scalar(select(func.count(Incident.id)).where(*cond)) or 0
    col = Incident.incident_date.asc() if order == "asc" else Incident.incident_date.desc()
    rows = db.scalars(select(Incident).where(*cond).order_by(col, Incident.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).all()
    types = db.scalars(select(Incident.incident_type).distinct()).all()
    return {"total": total, "page": page, "page_size": page_size, "types": sorted(types),
            "items": [IncidentOut.model_validate(r) for r in rows]}


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    return inc


@router.post("/incidents", response_model=IncidentOut, status_code=201)
def create_incident(body: IncidentIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    inc = Incident(**body.model_dump(), created_by=user.username)
    db.add(inc)
    db.commit()
    return inc


@router.put("/incidents/{incident_id}", response_model=IncidentOut)
def update_incident(incident_id: int, body: IncidentIn, db: Session = Depends(get_db),
                    user: User = Depends(require_admin)):
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    for k, v in body.model_dump().items():
        setattr(inc, k, v)
    db.commit()
    return inc


@router.delete("/incidents/{incident_id}", status_code=204)
def delete_incident(incident_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    db.delete(inc)
    db.commit()


# ---------- data sources ----------
REFERENCE_PORTALS = [
    {"name": "Central Pollution Control Board (CPCB)", "url": "https://cpcb.nic.in/",
     "note": "Water-quality criteria and monitoring publications."},
    {"name": "India-WRIS", "url": "https://indiawris.gov.in/", "note": "Water resources information portal."},
    {"name": "India Meteorological Department (IMD)", "url": "https://www.imd.gov.in/",
     "note": "Rainfall observations and gridded products."},
    {"name": "Uttar Pradesh Pollution Control Board", "url": "https://www.uppcb.com/",
     "note": "State-level monitoring reports."},
]


@router.get("/data-sources", response_model=list[DataSourceOut])
def list_sources(db: Session = Depends(get_db)):
    return db.scalars(select(DataSource).order_by(DataSource.id)).all()


@router.get("/data-sources/reference")
def reference_portals():
    """Official portals where datasets can be obtained. These are links only; no data is claimed to be loaded."""
    return REFERENCE_PORTALS


@router.post("/data-sources", response_model=DataSourceOut, status_code=201)
def create_source(body: DataSourceIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    s = DataSource(**body.model_dump())
    db.add(s)
    db.commit()
    return s


@router.put("/data-sources/{source_id}", response_model=DataSourceOut)
def update_source(source_id: int, body: DataSourceIn, db: Session = Depends(get_db),
                  user: User = Depends(require_admin)):
    s = db.get(DataSource, source_id)
    if not s:
        raise HTTPException(404, "Data source not found")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return s


@router.delete("/data-sources/{source_id}", status_code=204)
def delete_source(source_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    from ..models import Rainfall, WaterQuality
    s = db.get(DataSource, source_id)
    if not s:
        raise HTTPException(404, "Data source not found")
    used = (db.scalar(select(func.count(WaterQuality.id)).where(WaterQuality.source_id == source_id)) or 0) + \
           (db.scalar(select(func.count(Rainfall.id)).where(Rainfall.source_id == source_id)) or 0)
    if used:
        raise HTTPException(409, f"{used} records reference this source; it cannot be deleted")
    db.delete(s)
    db.commit()

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import services as S
from ..auth import create_token, require_admin, verify_password
from ..config import SECRET_HELP, auth_configured
from ..db import get_db
from ..models import DataSource, Incident, Rainfall, Station, User, WaterQuality
from ..params import PARAM_KEYS, PARAMS, RIVERS
from ..schemas import LoginIn, StationIn, StationOut, TokenOut

router = APIRouter()


@router.post("/api/auth/login", response_model=TokenOut, tags=["auth"])
def login(body: LoginIn, db: Session = Depends(get_db)):
    if not auth_configured():
        raise HTTPException(503, SECRET_HELP)
    user = db.scalar(select(User).where(User.username == body.username))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect username or password")
    return TokenOut(access_token=create_token(user.username))


@router.get("/api/auth/me", tags=["auth"])
def me(user: User = Depends(require_admin)):
    return {"username": user.username, "is_admin": user.is_admin}


@router.get("/api/dashboard", tags=["dashboard"])
def dashboard(db: Session = Depends(get_db)):
    wq_n = db.scalar(select(func.count(WaterQuality.id))) or 0
    rain_n = db.scalar(select(func.count(Rainfall.id))) or 0
    st_n = db.scalar(select(func.count(Station.id))) or 0
    inc_n = db.scalar(select(func.count(Incident.id))) or 0
    src_n = db.scalar(select(func.count(DataSource.id))) or 0
    wq_range = db.execute(select(func.min(WaterQuality.date), func.max(WaterQuality.date))).one()
    rain_range = db.execute(select(func.min(Rainfall.date), func.max(Rainfall.date))).one()

    wq = S.wq_frame(db)
    availability = []
    for k in PARAM_KEYS:
        have = int(wq[k].notna().sum()) if not wq.empty else 0
        availability.append({"parameter": k, "label": PARAMS[k]["label"], "unit": PARAMS[k]["unit"],
                             "records": have, "missing": wq_n - have})
    latest = []
    if not wq.empty:
        idx = wq.groupby("station_id")["date"].idxmax()
        for _, r in wq.loc[idx].sort_values(["river", "station"]).iterrows():
            latest.append({"station_id": int(r["station_id"]), "station": r["station"], "river": r["river"],
                           "date": r["date"].date().isoformat(),
                           **{k: S.f(r[k]) for k in PARAM_KEYS}})
    per_river = db.execute(select(Station.river, func.count(WaterQuality.id))
                           .join(WaterQuality, WaterQuality.station_id == Station.id)
                           .group_by(Station.river)).all()
    return {
        "totals": {"water_quality_records": wq_n, "rainfall_records": rain_n, "monitoring_locations": st_n,
                   "incidents": inc_n, "data_sources": src_n},
        "water_quality_range": {"from": wq_range[0], "to": wq_range[1]},
        "rainfall_range": {"from": rain_range[0], "to": rain_range[1]},
        "records_per_river": {r: n for r, n in per_river},
        "latest_observations": latest,
        "availability": availability,
        "has_data": bool(wq_n or rain_n),
    }


@router.get("/api/rivers", tags=["rivers"])
def rivers(db: Session = Depends(get_db)):
    out = []
    for r in RIVERS:
        st = db.scalar(select(func.count(Station.id)).where(Station.river == r)) or 0
        n = db.scalar(select(func.count(WaterQuality.id)).join(Station).where(Station.river == r)) or 0
        rng = db.execute(select(func.min(WaterQuality.date), func.max(WaterQuality.date))
                         .join(Station).where(Station.river == r)).one()
        out.append({"river": r, "stations": st, "records": n, "from": rng[0], "to": rng[1]})
    return out


@router.get("/api/locations", response_model=list[StationOut], tags=["locations"])
def locations(river: str | None = None, db: Session = Depends(get_db)):
    q = select(Station, func.count(WaterQuality.id), func.max(WaterQuality.date)) \
        .outerjoin(WaterQuality, WaterQuality.station_id == Station.id).group_by(Station.id)
    if river:
        q = q.where(Station.river == river)
    out = []
    for st, n, last in db.execute(q.order_by(Station.river, Station.name)).all():
        o = StationOut.model_validate(st)
        o.record_count, o.last_date = n, last
        out.append(o)
    return out


@router.post("/api/locations", response_model=StationOut, status_code=201, tags=["locations"])
def add_location(body: StationIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    if db.scalar(select(Station).where(Station.name == body.name, Station.river == body.river)):
        raise HTTPException(409, "A station with this name already exists on this river")
    st = Station(**body.model_dump())
    db.add(st)
    db.commit()
    return StationOut.model_validate(st)


@router.delete("/api/locations/{station_id}", status_code=204, tags=["locations"])
def delete_location(station_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    st = db.get(Station, station_id)
    if not st:
        raise HTTPException(404, "Station not found")
    if db.scalar(select(func.count(WaterQuality.id)).where(WaterQuality.station_id == station_id)):
        raise HTTPException(409, "Station has water-quality records and cannot be deleted")
    db.delete(st)
    db.commit()

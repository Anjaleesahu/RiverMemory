"""Shared data-access and statistics helpers. All numbers come from database rows."""
import calendar
from datetime import date

import numpy as np
import pandas as pd
from fastapi import HTTPException
from scipy import stats as sps
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Rainfall, Station, WaterQuality
from .params import PARAM_KEYS, PARAMS

MIN_PAIRS = 10  # minimum paired observations before any correlation is reported

WQ_COLS = ["id", "date", "station_id", "station", "river", "latitude", "longitude", "source_id"] + PARAM_KEYS


def check_param(parameter: str) -> str:
    if parameter not in PARAMS:
        raise HTTPException(422, f"Unknown parameter '{parameter}'. Valid: {', '.join(PARAM_KEYS)}")
    return parameter


def wq_frame(db: Session, river=None, station_id=None, d_from: date | None = None,
             d_to: date | None = None) -> pd.DataFrame:
    q = select(WaterQuality, Station).join(Station, WaterQuality.station_id == Station.id)
    if river:
        q = q.where(Station.river == river)
    if station_id:
        q = q.where(Station.id == station_id)
    if d_from:
        q = q.where(WaterQuality.date >= d_from)
    if d_to:
        q = q.where(WaterQuality.date <= d_to)
    rows = db.execute(q.order_by(WaterQuality.date)).all()
    recs = []
    for wq, st in rows:
        d = {"id": wq.id, "date": wq.date, "station_id": st.id, "station": st.name, "river": st.river,
             "latitude": st.latitude, "longitude": st.longitude, "source_id": wq.source_id}
        d.update({k: getattr(wq, k) for k in PARAM_KEYS})
        recs.append(d)
    df = pd.DataFrame(recs, columns=WQ_COLS)
    df["date"] = pd.to_datetime(df["date"])
    df[PARAM_KEYS] = df[PARAM_KEYS].astype(float)
    return df


def rain_frame(db: Session, d_from: date | None = None, d_to: date | None = None, kind=None,
               location=None) -> pd.DataFrame:
    q = select(Rainfall)
    if d_from:
        q = q.where(Rainfall.date >= d_from)
    if d_to:
        q = q.where(Rainfall.date <= d_to)
    if kind:
        q = q.where(Rainfall.kind == kind)
    if location:
        q = q.where(Rainfall.location == location)
    rows = db.scalars(q.order_by(Rainfall.date)).all()
    df = pd.DataFrame([{"id": r.id, "date": r.date, "location": r.location, "rainfall_mm": r.rainfall_mm,
                        "kind": r.kind, "resolution": r.resolution, "source_id": r.source_id} for r in rows],
                      columns=["id", "date", "location", "rainfall_mm", "kind", "resolution", "source_id"])
    df["date"] = pd.to_datetime(df["date"])
    df["rainfall_mm"] = df["rainfall_mm"].astype(float)
    return df


def period_of(dates: pd.Series, agg: str) -> pd.Series:
    if agg == "monthly":
        return dates.dt.to_period("M").astype(str)
    if agg == "yearly":
        return dates.dt.year.astype(str)
    if agg == "raw":
        return dates.dt.strftime("%Y-%m-%d")
    raise HTTPException(422, "agg must be raw, monthly or yearly")


def f(v, nd=4):
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    if isinstance(v, (np.floating, float)):
        return round(float(v), nd)
    if isinstance(v, (np.integer,)):
        return int(v)
    return v


def describe(s: pd.Series) -> dict:
    s = s.dropna()
    n = int(len(s))
    if n == 0:
        return {"n": 0, "min": None, "max": None, "mean": None, "median": None, "std": None}
    return {"n": n, "min": f(s.min()), "max": f(s.max()), "mean": f(s.mean()), "median": f(s.median()),
            "std": f(s.std(ddof=1)) if n > 1 else None}


def trend(dates: pd.Series, values: pd.Series) -> dict | None:
    m = values.notna()
    d, v = dates[m], values[m]
    if len(v) < 8 or v.nunique() < 2 or d.nunique() < 2:
        return None
    x = (d - d.min()).dt.days.to_numpy() / 365.25
    slope = float(np.polyfit(x, v.to_numpy(), 1)[0])
    rho, p = sps.spearmanr(x, v.to_numpy())
    return {"slope_per_year": f(slope), "spearman_rho": f(rho), "p_value": f(p), "n": int(len(v)),
            "note": "Monotonic trend over observation dates; irregular sampling and seasonality can distort it."}


def corr_pair(x: pd.Series, y: pd.Series) -> dict:
    m = x.notna() & y.notna()
    x, y = x[m], y[m]
    n = int(len(x))
    base = {"n": n, "pearson_r": None, "pearson_p": None, "spearman_rho": None, "spearman_p": None,
            "status": "ok", "reason": None}
    if n < MIN_PAIRS:
        base.update(status="insufficient_data", reason=f"Only {n} paired observations; at least {MIN_PAIRS} required.")
        return base
    if x.nunique() < 2 or y.nunique() < 2:
        base.update(status="insufficient_data", reason="One variable is constant over the paired observations.")
        return base
    pr, pp = sps.pearsonr(x, y)
    sr, sp = sps.spearmanr(x, y)
    base.update(pearson_r=f(pr), pearson_p=f(pp), spearman_rho=f(sr), spearman_p=f(sp))
    return base


def monthly_pairs(wq: pd.DataFrame, rain: pd.DataFrame) -> pd.DataFrame:
    """Monthly mean of each parameter joined to monthly rainfall total, complete rainfall months only."""
    if wq.empty or rain.empty:
        return pd.DataFrame(columns=["month", "rainfall_mm"] + PARAM_KEYS)
    # one rainfall value per day (mean across locations/kinds in the selection) then monthly total
    r = rain.dropna(subset=["rainfall_mm"]).groupby("date")["rainfall_mm"].mean().reset_index()
    r["month"] = r["date"].dt.to_period("M")
    g = r.groupby("month").agg(rainfall_mm=("rainfall_mm", "sum"), days=("rainfall_mm", "count")).reset_index()
    g["complete"] = [d == calendar.monthrange(m.year, m.month)[1] for m, d in zip(g["month"], g["days"])]
    g = g[g["complete"]]
    w = wq.copy()
    w["month"] = w["date"].dt.to_period("M")
    wm = w.groupby("month")[PARAM_KEYS].mean().reset_index()
    out = wm.merge(g[["month", "rainfall_mm"]], on="month", how="inner")
    out["month"] = out["month"].astype(str)
    return out

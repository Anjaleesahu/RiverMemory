import calendar
from datetime import date

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from .. import services as S
from ..db import get_db
from ..models import Rainfall

router = APIRouter(prefix="/api/rainfall", tags=["rainfall"])

METHOD_NOTE = ("Rows marked 'gridded' are area estimates from a gridded product at the stated resolution, not "
               "direct rain-gauge observations. Rows marked 'gauge' are point observations. Monthly and yearly "
               "totals are sums of the daily values present in the database; periods with missing days are "
               "flagged and their totals are lower bounds.")


def _f(d_from: date | None = Query(None, alias="from"), d_to: date | None = Query(None, alias="to"),
       kind: str | None = Query(None, pattern="^(gridded|gauge)$"), location: str | None = None):
    return dict(d_from=d_from, d_to=d_to, kind=kind, location=location)


def _daily(df: pd.DataFrame) -> pd.DataFrame:
    """One value per calendar day (mean if several locations/kinds are present)."""
    d = df.dropna(subset=["rainfall_mm"])
    return d.groupby("date", as_index=False)["rainfall_mm"].mean()


@router.get("/meta")
def meta(db: Session = Depends(get_db)):
    locs = db.scalars(select(distinct(Rainfall.location))).all()
    kinds = db.scalars(select(distinct(Rainfall.kind))).all()
    res = [r for r in db.scalars(select(distinct(Rainfall.resolution))).all() if r]
    return {"locations": locs, "kinds": kinds, "resolutions": res, "method_note": METHOD_NOTE}


@router.get("")
def records(f=Depends(_f), page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
            order: str = Query("desc", pattern="^(asc|desc)$"), db: Session = Depends(get_db)):
    df = S.rain_frame(db, **f).sort_values("date", ascending=(order == "asc"))
    part = df.iloc[(page - 1) * page_size: page * page_size].copy()
    part["date"] = part["date"].dt.strftime("%Y-%m-%d")
    items = [{k: (None if pd.isna(v) else v) for k, v in r.items()} for r in part.to_dict("records")]
    return {"total": len(df), "page": page, "page_size": page_size, "items": items}


@router.get("/aggregate")
def aggregate(f=Depends(_f), period: str = Query("monthly", pattern="^(daily|monthly|yearly)$"),
              db: Session = Depends(get_db)):
    df = S.rain_frame(db, **f)
    d = _daily(df)
    if d.empty:
        return {"period": period, "points": [], "note": METHOD_NOTE}
    if period == "daily":
        pts = [{"period": r.date.strftime("%Y-%m-%d"), "rainfall_mm": S.f(r.rainfall_mm)} for r in d.itertuples()]
        return {"period": period, "points": pts, "note": METHOD_NOTE}
    key = d["date"].dt.to_period("M") if period == "monthly" else d["date"].dt.year
    g = d.groupby(key)["rainfall_mm"].agg(total="sum", days="count", rainy_days=lambda s: int((s >= 2.5).sum()),
                                           max_daily="max").reset_index()
    pts = []
    for r in g.itertuples():
        if period == "monthly":
            expected = calendar.monthrange(r[1].year, r[1].month)[1]
            label = str(r[1])
        else:
            expected = 366 if calendar.isleap(int(r[1])) else 365
            label = str(r[1])
        pts.append({"period": label, "rainfall_mm": S.f(r.total, 2), "days_with_data": int(r.days),
                    "days_expected": expected, "complete": int(r.days) == expected,
                    "rainy_days_ge_2_5mm": int(r.rainy_days), "max_daily_mm": S.f(r.max_daily, 2)})
    return {"period": period, "points": pts, "note": METHOD_NOTE}


@router.get("/summary")
def summary(f=Depends(_f), db: Session = Depends(get_db)):
    df = S.rain_frame(db, **f)
    d = _daily(df)
    if d.empty:
        return {"records": 0, "stats": S.describe(pd.Series(dtype=float)), "note": METHOD_NOTE}
    full = pd.date_range(d["date"].min(), d["date"].max(), freq="D")
    missing_days = int(len(full) - len(d))
    wettest = d.loc[d["rainfall_mm"].idxmax()]
    # climatology: mean monthly total per calendar month, using complete months only
    m = d.assign(m=d["date"].dt.to_period("M")).groupby("m")["rainfall_mm"].agg(["sum", "count"]).reset_index()
    m = m[[c == calendar.monthrange(p.year, p.month)[1] for p, c in zip(m["m"], m["count"])]]
    clim = []
    if not m.empty:
        m["moy"] = [p.month for p in m["m"]]
        for moy, grp in m.groupby("moy"):
            clim.append({"month": int(moy), "month_name": calendar.month_abbr[int(moy)],
                         "mean_total_mm": S.f(grp["sum"].mean(), 2), "years": int(len(grp))})
    return {"records": int(len(df)), "days_with_data": int(len(d)), "range": {"from": d["date"].min().date(),
            "to": d["date"].max().date()}, "missing_days_in_range": missing_days,
            "stats": S.describe(d["rainfall_mm"]), "total_mm": S.f(d["rainfall_mm"].sum(), 1),
            "wettest_day": {"date": wettest["date"].date(), "rainfall_mm": S.f(wettest["rainfall_mm"], 2)},
            "monthly_climatology": clim, "kinds_present": sorted(df["kind"].unique().tolist()),
            "resolutions": sorted([r for r in df["resolution"].dropna().unique().tolist()]), "note": METHOD_NOTE}


@router.get("/distribution")
def distribution(f=Depends(_f), db: Session = Depends(get_db)):
    d = _daily(S.rain_frame(db, **f))
    if d.empty:
        return {"bins": []}
    s = d["rainfall_mm"]
    edges = [(0, 0), (0.01, 2.5), (2.5, 10), (10, 25), (25, 50), (50, 100), (100, 1e9)]
    labels = ["0 (dry)", "<2.5 mm", "2.5-10 mm", "10-25 mm", "25-50 mm", "50-100 mm", ">100 mm"]
    bins = []
    for (lo, hi), lab in zip(edges, labels):
        if lab == "0 (dry)":
            c = int((s <= 0).sum())
        elif lab == "<2.5 mm":
            c = int(((s > 0) & (s < 2.5)).sum())
        else:
            c = int(((s >= lo) & (s < hi)).sum())
        bins.append({"bin": lab, "days": c})
    return {"bins": bins, "total_days": int(len(s))}

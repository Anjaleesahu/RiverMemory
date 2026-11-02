from datetime import date

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import services as S
from ..db import get_db
from ..models import Incident, Station
from ..params import BATHING_CRITERIA, PARAM_KEYS, PARAMS, RIVERS

router = APIRouter(prefix="/api", tags=["analysis"])

CAUSATION_NOTE = ("Correlation measures association, not causation. Monthly mean water quality is paired with the "
                  "monthly rainfall total of complete months only; other factors (discharge, season, sampling "
                  "site, treatment, upstream rainfall) are not controlled for. Results with fewer than "
                  f"{S.MIN_PAIRS} paired months are not reported.")


def _f(river: str | None = None, station_id: int | None = None,
       d_from: date | None = Query(None, alias="from"), d_to: date | None = Query(None, alias="to")):
    return dict(river=river, station_id=station_id, d_from=d_from, d_to=d_to)


@router.get("/comparison")
def comparison(parameter: str, agg: str = "monthly", d_from: date | None = Query(None, alias="from"),
               d_to: date | None = Query(None, alias="to"), db: Session = Depends(get_db)):
    S.check_param(parameter)
    df = S.wq_frame(db, d_from=d_from, d_to=d_to)
    df = df[df["river"].isin(RIVERS)]
    d = df[df[parameter].notna()].copy()
    rivers = {}
    for r in RIVERS:
        sub = d[d["river"] == r]
        rivers[r] = {"stats": S.describe(sub[parameter]), "stations": sorted(sub["station"].unique().tolist()),
                     "first": sub["date"].min().date() if len(sub) else None,
                     "last": sub["date"].max().date() if len(sub) else None,
                     "trend": S.trend(sub["date"], sub[parameter]) if len(sub) else None}
    points = []
    if not d.empty:
        d["period"] = S.period_of(d["date"], agg)
        pv = d.groupby(["period", "river"])[parameter].mean().unstack("river").sort_index()
        for r in RIVERS:
            if r not in pv.columns:
                pv[r] = np.nan
        points = [{"period": p, **{r: S.f(row[r]) for r in RIVERS},
                   "both": bool(pd.notna(row["Ganga"]) and pd.notna(row["Yamuna"]))} for p, row in pv.iterrows()]
    overlap = sum(1 for p in points if p["both"])
    notes = ["Parameter units are fixed in the database, so units are compatible across rivers.",
             "Rivers are sampled at different stations; differences reflect station mix as well as river condition.",
             "Methods (e.g. BOD incubation) follow each dataset's source; check the Data Sources page."]
    if overlap == 0 and points:
        notes.append("No period has observations for both rivers, so a like-for-like comparison is not possible.")
    return {"parameter": parameter, "label": PARAMS[parameter]["label"], "unit": PARAMS[parameter]["unit"],
            "agg": agg, "rivers": rivers, "points": points, "overlapping_periods": overlap, "notes": notes}


@router.get("/analysis/criteria")
def criteria():
    return BATHING_CRITERIA


@router.get("/analysis/correlation")
def correlation(f=Depends(_f), db: Session = Depends(get_db)):
    wq = S.wq_frame(db, **f)
    rain = S.rain_frame(db, d_from=f["d_from"], d_to=f["d_to"])
    pairs = S.monthly_pairs(wq, rain)
    rows = []
    for k in PARAM_KEYS:
        if wq[k].notna().sum() == 0:
            continue
        r = S.corr_pair(pairs[k], pairs["rainfall_mm"]) if not pairs.empty else \
            {"n": 0, "status": "insufficient_data", "reason": "No overlapping complete months of rainfall and water quality.",
             "pearson_r": None, "pearson_p": None, "spearman_rho": None, "spearman_p": None}
        rows.append({"parameter": k, "label": PARAMS[k]["label"], **r})
    keys = ["rainfall_mm"] + [k for k in PARAM_KEYS if not pairs.empty and pairs[k].notna().sum() > 0]
    matrix = []
    for a in keys:
        for b in keys:
            c = S.corr_pair(pairs[a], pairs[b]) if not pairs.empty else {"n": 0, "spearman_rho": None}
            matrix.append({"x": a, "y": b, "rho": c["spearman_rho"] if a != b else 1.0, "n": c["n"]})
    return {"method": "Monthly mean water quality vs monthly rainfall total (complete months); Pearson and Spearman",
            "months_paired": int(len(pairs)), "pairs": rows, "matrix_keys": keys, "matrix": matrix,
            "labels": {"rainfall_mm": "Rainfall (mm/month)", **{k: PARAMS[k]["label"] for k in PARAM_KEYS}},
            "note": CAUSATION_NOTE}


@router.get("/analysis/scatter")
def scatter(parameter: str, f=Depends(_f), db: Session = Depends(get_db)):
    S.check_param(parameter)
    pairs = S.monthly_pairs(S.wq_frame(db, **f), S.rain_frame(db, d_from=f["d_from"], d_to=f["d_to"]))
    pts = []
    if not pairs.empty:
        p = pairs.dropna(subset=[parameter])
        pts = [{"month": r["month"], "rainfall_mm": S.f(r["rainfall_mm"], 2), "value": S.f(r[parameter])}
               for _, r in p.iterrows()]
    return {"parameter": parameter, "label": PARAMS[parameter]["label"], "unit": PARAMS[parameter]["unit"],
            "points": pts, "stats": S.corr_pair(pd.Series([x["value"] for x in pts], dtype=float),
                                                 pd.Series([x["rainfall_mm"] for x in pts], dtype=float)),
            "note": CAUSATION_NOTE}


@router.get("/analysis/outliers")
def outliers(parameter: str, f=Depends(_f), threshold: float = Query(3.5, ge=2, le=10),
             db: Session = Depends(get_db)):
    """Robust z-score (median/MAD) per river. Flags statistical outliers only."""
    S.check_param(parameter)
    df = S.wq_frame(db, **f)
    df = df[df[parameter].notna()]
    items, skipped = [], []
    for river, sub in df.groupby("river"):
        s = sub[parameter]
        if len(s) < 8:
            skipped.append({"river": river, "reason": f"only {len(s)} observations (need 8)"})
            continue
        med = s.median()
        mad = (s - med).abs().median()
        if mad == 0:
            skipped.append({"river": river, "reason": "MAD is zero (values nearly constant)"})
            continue
        z = 0.6745 * (s - med) / mad
        for idx in z[z.abs() > threshold].index:
            r = sub.loc[idx]
            items.append({"date": r["date"].date(), "river": river, "station": r["station"],
                          "value": S.f(r[parameter]), "robust_z": S.f(z[idx], 2), "median": S.f(med)})
    return {"parameter": parameter, "unit": PARAMS[parameter]["unit"], "threshold": threshold, "items": items,
            "skipped": skipped,
            "method": "Robust z = 0.6745*(x - median)/MAD, computed per river over the selected records.",
            "limitations": ("A flagged value is a statistical outlier, not a confirmed pollution incident. It may "
                            "reflect natural variability, seasonality, instrument or entry error, or a real event; "
                            "it needs field verification.")}


@router.get("/analysis/missing")
def missing(f=Depends(_f), db: Session = Depends(get_db)):
    df = S.wq_frame(db, **f)
    total = len(df)
    out = []
    for k in PARAM_KEYS:
        miss = int(total - df[k].notna().sum())
        by_river = {r: int(df[(df.river == r)][k].isna().sum()) for r in RIVERS} if total else {}
        out.append({"parameter": k, "label": PARAMS[k]["label"], "missing": miss, "total": total,
                    "pct_missing": S.f(100 * miss / total, 1) if total else None, "missing_by_river": by_river})
    return {"records": total, "parameters": out}


@router.get("/timeline")
def timeline(parameter: str = "do_mg_l", river: str | None = None,
             d_from: date | None = Query(None, alias="from"), d_to: date | None = Query(None, alias="to"),
             db: Session = Depends(get_db)):
    S.check_param(parameter)
    wq = S.wq_frame(db, river=river, d_from=d_from, d_to=d_to)
    rain = S.rain_frame(db, d_from=d_from, d_to=d_to)
    months = {}
    w = wq[wq[parameter].notna()]
    if not w.empty:
        for p, v in w.groupby(w["date"].dt.to_period("M").astype(str))[parameter].mean().items():
            months.setdefault(p, {})["value"] = S.f(v)
    if not rain.empty:
        d = rain.dropna(subset=["rainfall_mm"]).groupby("date")["rainfall_mm"].mean().reset_index()
        g = d.groupby(d["date"].dt.to_period("M").astype(str))["rainfall_mm"].agg(["sum", "count"])
        for p, r in g.iterrows():
            months.setdefault(p, {})["rainfall_mm"] = S.f(r["sum"], 2)
            months[p]["rain_days"] = int(r["count"])
    from sqlalchemy import select
    q = select(Incident).order_by(Incident.incident_date)
    if river:
        q = q.where(Incident.river == river)
    if d_from:
        q = q.where(Incident.incident_date >= d_from)
    if d_to:
        q = q.where(Incident.incident_date <= d_to)
    inc = [{"id": i.id, "date": i.incident_date, "title": i.title, "river": i.river, "type": i.incident_type,
            "severity": i.severity, "location": i.location} for i in db.scalars(q).all()]
    return {"parameter": parameter, "label": PARAMS[parameter]["label"], "unit": PARAMS[parameter]["unit"],
            "months": [{"month": m, **v} for m, v in sorted(months.items())], "incidents": inc}

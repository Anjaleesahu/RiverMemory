from datetime import date

import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import services as S
from ..db import get_db
from ..params import BATHING_CRITERIA, PARAM_KEYS, PARAMS

router = APIRouter(prefix="/api/water-quality", tags=["water-quality"])


def _filters(river: str | None = None, station_id: int | None = None,
             d_from: date | None = Query(None, alias="from"), d_to: date | None = Query(None, alias="to")):
    return dict(river=river, station_id=station_id, d_from=d_from, d_to=d_to)


@router.get("/parameters")
def parameters():
    return [{"key": k, **{kk: vv for kk, vv in v.items() if kk != "range"}} for k, v in PARAMS.items()]


@router.get("")
def records(f=Depends(_filters), page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
            sort: str = Query("date"), order: str = Query("desc", pattern="^(asc|desc)$"),
            db: Session = Depends(get_db)):
    df = S.wq_frame(db, **f)
    if sort not in df.columns:
        sort = "date"
    df = df.sort_values(sort, ascending=(order == "asc"), na_position="last")
    total = len(df)
    part = df.iloc[(page - 1) * page_size: page * page_size].copy()
    part["date"] = part["date"].dt.strftime("%Y-%m-%d")
    items = [{k: (None if pd.isna(v) else (S.f(v) if isinstance(v, float) else v)) for k, v in r.items()}
             for r in part.to_dict("records")]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/series")
def series(parameter: str, f=Depends(_filters), agg: str = "monthly", group: str = "river",
           db: Session = Depends(get_db)):
    S.check_param(parameter)
    df = S.wq_frame(db, **f)
    df = df[df[parameter].notna()].copy()
    gcol = "station" if (f["station_id"] or group == "station") else "river"
    if df.empty:
        return {"parameter": parameter, "label": PARAMS[parameter]["label"], "unit": PARAMS[parameter]["unit"],
                "agg": agg, "groups": [], "points": [], "n": 0}
    df["period"] = S.period_of(df["date"], agg)
    pv = df.groupby(["period", gcol])[parameter].mean().unstack(gcol).sort_index()
    points = [{"period": p, **{c: S.f(v) for c, v in row.items()}} for p, row in pv.iterrows()]
    return {"parameter": parameter, "label": PARAMS[parameter]["label"], "unit": PARAMS[parameter]["unit"],
            "agg": agg, "groups": list(pv.columns), "points": points, "n": int(len(df))}


@router.get("/summary")
def summary(f=Depends(_filters), db: Session = Depends(get_db)):
    df = S.wq_frame(db, **f)
    total = len(df)
    lim = BATHING_CRITERIA["limits"]
    out = []
    for k in PARAM_KEYS:
        s = df[k]
        row = {"parameter": k, "label": PARAMS[k]["label"], "unit": PARAMS[k]["unit"], **S.describe(s),
               "missing": int(total - s.notna().sum()), "total_records": total,
               "trend": S.trend(df["date"], s) if total else None, "criteria": None}
        if k in lim and row["n"]:
            c = lim[k]
            ok = pd.Series(True, index=s.index)
            if "min" in c:
                ok &= s >= c["min"]
            if "max" in c:
                ok &= s <= c["max"]
            ok = ok[s.notna()]
            row["criteria"] = {"limit": c, "within": int(ok.sum()), "outside": int((~ok).sum()),
                               "pct_within": S.f(100 * ok.mean(), 1)}
        out.append(row)
    return {"filters": {k: (str(v) if v else None) for k, v in f.items()}, "records": total, "parameters": out,
            "criteria_note": BATHING_CRITERIA["applicability"], "criteria_name": BATHING_CRITERIA["name"],
            "criteria_url": BATHING_CRITERIA["source_url"]}

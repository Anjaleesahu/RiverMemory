"""CSV dataset import with validation, preview, duplicate detection and a rejected-rows report.

Original measurements are never altered: values are stored exactly as parsed, and any row that cannot be
parsed is rejected and reported rather than silently fixed.
"""
import io
import re
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..config import settings
from ..db import get_db
from ..models import DataSource, ImportBatch, Rainfall, Station, User, WaterQuality
from ..params import (PARAM_KEYS, PARAMS, RAIN_ALIASES, RIVER_NORMALIZE, STATION_ALIASES, WQ_ALIASES)

router = APIRouter(prefix="/api/import", tags=["import"])

KINDS = {"water_quality": WQ_ALIASES, "rainfall": RAIN_ALIASES, "stations": STATION_ALIASES}
MISSING_TOKENS = {"", "na", "n/a", "nan", "null", "-", "--", "nd", "bdl", "none"}
DATE_FORMATS = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]
TEMPLATES = {
    "water_quality": "date,station,river,latitude,longitude," + ",".join(PARAM_KEYS) + "\n",
    "rainfall": "date,rainfall_mm,location,kind,resolution\n",
    "stations": "station,river,latitude,longitude\n",
}
MAX_ROWS = 200_000
MAX_REJECT_REPORT = 300


def _norm_col(c: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", c.strip().lower()).strip("_")


def _read(file: UploadFile, kind: str):
    if kind not in KINDS:
        raise HTTPException(422, f"kind must be one of {', '.join(KINDS)}")
    name = file.filename or "upload.csv"
    if not name.lower().endswith(".csv"):
        raise HTTPException(415, "Only .csv files are supported")
    raw = file.file.read(settings.MAX_UPLOAD_BYTES + 1)
    if len(raw) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit")
    if not raw.strip():
        raise HTTPException(422, "File is empty")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(422, "File must be UTF-8 encoded text")
    try:
        df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False, skipinitialspace=True)
    except Exception as e:
        raise HTTPException(422, f"Could not parse CSV: {e}")
    if len(df) > MAX_ROWS:
        raise HTTPException(413, f"Too many rows (max {MAX_ROWS})")
    aliases = KINDS[kind]
    mapping, unknown = {}, []
    for c in df.columns:
        n = _norm_col(c)
        if n in aliases:
            canon = aliases[n]
            if canon in mapping.values():
                raise HTTPException(422, f"Column '{c}' duplicates another column mapped to '{canon}'")
            mapping[c] = canon
        else:
            unknown.append(c)
    df = df.rename(columns=mapping)[list(mapping.values())]
    return name, df, unknown


def _date(v: str):
    v = v.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    return None


def _num(v: str):
    """Returns (value, status) with status in ok | missing | invalid."""
    v = (v or "").strip()
    if v.lower() in MISSING_TOKENS:
        return None, "missing"
    try:
        x = float(v.replace(",", ""))
    except ValueError:
        return None, "invalid"
    if x != x or x in (float("inf"), float("-inf")):
        return None, "invalid"
    return x, "ok"


def _coord(lat, lon):
    la, sa = _num(lat or "")
    lo, so = _num(lon or "")
    if sa == "missing" and so == "missing":
        return None, None, None
    if sa != "ok" or so != "ok":
        return None, None, "latitude/longitude must both be valid numbers"
    if not (6 <= la <= 38 and 68 <= lo <= 98):
        return None, None, f"coordinates ({la}, {lo}) fall outside India's bounding box"
    return la, lo, None


def _process(kind, df, db, form):
    rows, rejected, dup, missing_counts = [], [], 0, {}
    seen = set()
    cols = set(df.columns)
    needs = {"water_quality": {"date", "station", "river"}, "rainfall": {"date", "rainfall_mm"},
             "stations": {"station", "river", "latitude", "longitude"}}[kind]
    if needs - cols:
        raise HTTPException(422, f"Missing required column(s): {', '.join(sorted(needs - cols))}")
    if kind == "water_quality" and not (cols & set(PARAM_KEYS)):
        raise HTTPException(422, "No recognised water-quality parameter columns found")
    if kind == "rainfall":
        if "location" not in cols and not form.get("location"):
            raise HTTPException(422, "Provide a 'location' column or the location form field")
        if "kind" not in cols and form.get("rainfall_kind") not in ("gridded", "gauge"):
            raise HTTPException(422, "Provide a 'kind' column or choose gridded/gauge")

    stations = {(s.name.lower(), s.river): s for s in db.scalars(select(Station)).all()}
    st_ids = {s.id: k for k, s in stations.items()}
    existing_wq = set()
    existing_rain = set()
    if kind == "water_quality":
        existing_wq = {(st_ids.get(sid), d) for sid, d in db.execute(select(WaterQuality.station_id, WaterQuality.date))}
    if kind == "rainfall":
        existing_rain = {(d, loc.lower(), k) for d, loc, k in db.execute(select(Rainfall.date, Rainfall.location, Rainfall.kind))}

    for i, r in enumerate(df.to_dict("records")):
        line = i + 2
        def rej(msg):
            rejected.append({"row": line, "reason": msg})
        if kind == "stations":
            river = RIVER_NORMALIZE.get(r["river"].strip().lower())
            if not river:
                rej(f"river '{r['river']}' not supported (Ganga or Yamuna)"); continue
            name = r["station"].strip()
            la, lo, err = _coord(r["latitude"], r["longitude"])
            if not name or err or la is None:
                rej(err or "station name and coordinates are required"); continue
            key = (name.lower(), river)
            if key in stations or key in seen:
                dup += 1; continue
            seen.add(key)
            rows.append({"station": name, "river": river, "latitude": la, "longitude": lo})
            continue

        d = _date(r["date"])
        if not d:
            rej(f"invalid date '{r['date']}' (use YYYY-MM-DD or DD-MM-YYYY)"); continue
        if d > datetime.now(timezone.utc).date():
            rej(f"date {d} is in the future"); continue

        if kind == "rainfall":
            x, st = _num(r["rainfall_mm"])
            if st == "missing":
                missing_counts["rainfall_mm"] = missing_counts.get("rainfall_mm", 0) + 1
                rej("rainfall value missing (row not stored)"); continue
            if st == "invalid" or x < 0 or x > 1500:
                rej(f"rainfall '{r['rainfall_mm']}' is not a plausible daily value in mm (0-1500)"); continue
            loc = (r.get("location") or form.get("location") or "").strip()
            k = (r.get("kind") or form.get("rainfall_kind") or "").strip().lower()
            if not loc or k not in ("gridded", "gauge"):
                rej("location is empty or kind is not 'gridded'/'gauge'"); continue
            key = (d, loc.lower(), k)
            if key in existing_rain or key in seen:
                dup += 1; continue
            seen.add(key)
            rows.append({"date": d, "location": loc, "rainfall_mm": x, "kind": k,
                         "resolution": (r.get("resolution") or form.get("resolution") or None)})
            continue

        # water quality
        river = RIVER_NORMALIZE.get(r["river"].strip().lower())
        if not river:
            rej(f"river '{r['river']}' not accepted (only Ganga and Yamuna; no verified Saraswati measurements)"); continue
        name = r["station"].strip()
        if not name:
            rej("station is empty"); continue
        la, lo, err = _coord(r.get("latitude", ""), r.get("longitude", ""))
        if err:
            rej(err); continue
        vals, bad = {}, None
        for k in PARAM_KEYS:
            if k not in r:
                continue
            x, st = _num(r[k])
            if st == "missing":
                missing_counts[k] = missing_counts.get(k, 0) + 1
                vals[k] = None
            elif st == "invalid":
                bad = f"{k}: '{r[k]}' is not numeric"; break
            else:
                lo_, hi_ = PARAMS[k]["range"]
                if not (lo_ <= x <= hi_):
                    bad = f"{k}={x} outside plausible range {lo_}-{hi_} {PARAMS[k]['unit']}"; break
                vals[k] = x
        if bad:
            rej(bad); continue
        if all(v is None for v in vals.values()):
            rej("no parameter values present"); continue
        key = (name.lower(), river)
        if (key, d) in existing_wq or (key, d) in seen:
            dup += 1; continue
        seen.add((key, d))
        rows.append({"date": d, "station": name, "river": river, "latitude": la, "longitude": lo, **vals})
    return rows, rejected, dup, missing_counts


def _summary(kind, name, df, unknown, rows, rejected, dup, missing):
    prev = [{k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in r.items()} for r in rows[:10]]
    return {"kind": kind, "filename": name, "total_rows": int(len(df)), "valid_rows": len(rows),
            "duplicate_rows": dup, "rejected_rows": len(rejected), "rejected": rejected[:MAX_REJECT_REPORT],
            "rejected_truncated": len(rejected) > MAX_REJECT_REPORT, "columns_recognised": list(df.columns),
            "columns_ignored": unknown, "missing_values_by_column": missing, "preview": prev}


def _form(location, rainfall_kind, resolution):
    return {"location": (location or "").strip() or None, "rainfall_kind": rainfall_kind, "resolution": resolution}


@router.get("/template/{kind}", response_class=PlainTextResponse)
def template(kind: str):
    if kind not in TEMPLATES:
        raise HTTPException(404, "Unknown template")
    return PlainTextResponse(TEMPLATES[kind], media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={kind}_template.csv"})


@router.post("/preview")
def preview(kind: str = Form(...), file: UploadFile = File(...), location: str | None = Form(None),
            rainfall_kind: str | None = Form(None), resolution: str | None = Form(None),
            db: Session = Depends(get_db), user: User = Depends(require_admin)):
    name, df, unknown = _read(file, kind)
    rows, rej, dup, miss = _process(kind, df, db, _form(location, rainfall_kind, resolution))
    return {**_summary(kind, name, df, unknown, rows, rej, dup, miss), "committed": False}


@router.post("/commit", status_code=201)
def commit(kind: str = Form(...), file: UploadFile = File(...), source_id: int | None = Form(None),
           location: str | None = Form(None), rainfall_kind: str | None = Form(None),
           resolution: str | None = Form(None), db: Session = Depends(get_db),
           user: User = Depends(require_admin)):
    if source_id is not None and not db.get(DataSource, source_id):
        raise HTTPException(422, "source_id does not exist; register the data source first")
    name, df, unknown = _read(file, kind)
    rows, rej, dup, miss = _process(kind, df, db, _form(location, rainfall_kind, resolution))
    batch = ImportBatch(kind=kind, filename=name, source_id=source_id, rows_total=len(df), rows_imported=len(rows),
                        rows_duplicate=dup, rows_rejected=len(rej), imported_by=user.username)
    db.add(batch)
    db.flush()
    if kind == "stations":
        for r in rows:
            db.add(Station(name=r["station"], river=r["river"], latitude=r["latitude"], longitude=r["longitude"],
                           source_id=source_id))
    elif kind == "rainfall":
        for r in rows:
            db.add(Rainfall(**r, source_id=source_id, batch_id=batch.id))
    else:
        cache = {(s.name.lower(), s.river): s for s in db.scalars(select(Station)).all()}
        for r in rows:
            key = (r["station"].lower(), r["river"])
            st = cache.get(key)
            if st is None:
                st = Station(name=r["station"], river=r["river"], latitude=r["latitude"], longitude=r["longitude"],
                             source_id=source_id)
                db.add(st)
                db.flush()
                cache[key] = st
            elif st.latitude is None and r["latitude"] is not None:
                st.latitude, st.longitude = r["latitude"], r["longitude"]
            db.add(WaterQuality(station_id=st.id, date=r["date"], source_id=source_id, batch_id=batch.id,
                                **{k: r.get(k) for k in PARAM_KEYS}))
    db.commit()
    return {**_summary(kind, name, df, unknown, rows, rej, dup, miss), "committed": True, "batch_id": batch.id}


@router.get("/batches")
def batches(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    rows = db.scalars(select(ImportBatch).order_by(ImportBatch.id.desc()).limit(100)).all()
    return [{"id": b.id, "kind": b.kind, "filename": b.filename, "source_id": b.source_id,
             "rows_total": b.rows_total, "rows_imported": b.rows_imported, "rows_duplicate": b.rows_duplicate,
             "rows_rejected": b.rows_rejected, "imported_by": b.imported_by, "created_at": b.created_at}
            for b in rows]

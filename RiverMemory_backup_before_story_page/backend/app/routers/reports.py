import io
from datetime import date, datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import services as S
from ..db import get_db
from ..models import Incident
from ..params import BATHING_CRITERIA, PARAM_KEYS, PARAMS
from .rain import METHOD_NOTE

router = APIRouter(prefix="/api/reports", tags=["reports"])
PDF_ROW_CAP = 150


def _frame(dataset, db, river, d_from, d_to):
    if dataset == "water-quality":
        df = S.wq_frame(db, river=river, d_from=d_from, d_to=d_to)
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        return df.drop(columns=["id", "station_id", "source_id"])
    if dataset == "rainfall":
        df = S.rain_frame(db, d_from=d_from, d_to=d_to)
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        return df.drop(columns=["id", "source_id"])
    if dataset == "incidents":
        q = select(Incident).order_by(Incident.incident_date)
        if river:
            q = q.where(Incident.river == river)
        if d_from:
            q = q.where(Incident.incident_date >= d_from)
        if d_to:
            q = q.where(Incident.incident_date <= d_to)
        cols = ["incident_date", "title", "river", "location", "latitude", "longitude", "incident_type", "severity",
                "description", "evidence_source"]
        return pd.DataFrame([{c: getattr(i, c) for c in cols} for i in db.scalars(q).all()], columns=cols)
    raise HTTPException(404, "dataset must be water-quality, rainfall or incidents")


def _summary_rows(dataset, df):
    if dataset == "water-quality":
        rows = [["Parameter", "Unit", "n", "Min", "Max", "Mean", "Median"]]
        for k in PARAM_KEYS:
            d = S.describe(df[k])
            rows.append([PARAMS[k]["label"][:34], PARAMS[k]["unit"], d["n"], d["min"], d["max"], d["mean"], d["median"]])
        return rows
    if dataset == "rainfall":
        d = S.describe(df["rainfall_mm"])
        return [["Metric", "Value"], ["Daily records", d["n"]], ["Min (mm)", d["min"]], ["Max (mm)", d["max"]],
                ["Mean (mm/day)", d["mean"]], ["Median (mm/day)", d["median"]],
                ["Total (mm)", S.f(df["rainfall_mm"].sum(), 1)]]
    return [["Metric", "Value"], ["Incidents", len(df)]]


@router.get("/{dataset}")
def report(dataset: str, format: str = Query("csv", pattern="^(csv|xlsx|pdf)$"), river: str | None = None,
           d_from: date | None = Query(None, alias="from"), d_to: date | None = Query(None, alias="to"),
           db: Session = Depends(get_db)):
    df = _frame(dataset, db, river, d_from, d_to)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    base = f"rivermemory_{dataset}_{river or 'all'}_{stamp}"
    if format == "csv":
        return Response(df.to_csv(index=False), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{base}.csv"'})
    if format == "xlsx":
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as w:
            df.to_excel(w, sheet_name="Data", index=False)
            pd.DataFrame(_summary_rows(dataset, df)[1:], columns=_summary_rows(dataset, df)[0]).to_excel(
                w, sheet_name="Summary", index=False)
        return Response(buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f'attachment; filename="{base}.xlsx"'})
    # PDF
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
    st = getSampleStyleSheet()
    flow = [Paragraph(f"RiverMemory - {dataset.replace('-', ' ').title()} report", st["Title"]),
            Paragraph(f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC. River: {river or 'all'}. "
                      f"From: {d_from or 'start'}. To: {d_to or 'latest'}. Records: {len(df)}.", st["Normal"]),
            Spacer(1, 10)]
    if df.empty:
        flow.append(Paragraph("No data available for the selected filters.", st["Normal"]))
    else:
        flow.append(Paragraph("Summary", st["Heading2"]))
        sr = [[("" if c is None else c) for c in row] for row in _summary_rows(dataset, df)]
        t = Table(sr, repeatRows=1)
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b2545")),
                               ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTSIZE", (0, 0), (-1, -1), 8),
                               ("GRID", (0, 0), (-1, -1), 0.25, colors.grey)]))
        flow += [t, Spacer(1, 10)]
        if dataset == "water-quality":
            flow.append(Paragraph(BATHING_CRITERIA["applicability"], st["Italic"]))
        if dataset == "rainfall":
            flow.append(Paragraph(METHOD_NOTE, st["Italic"]))
        flow += [Spacer(1, 10), Paragraph(f"Records (first {min(len(df), PDF_ROW_CAP)} of {len(df)})", st["Heading2"])]
        show = df.head(PDF_ROW_CAP).fillna("")
        if dataset == "incidents":
            show = show[["incident_date", "title", "river", "incident_type", "severity", "location"]]
        elif dataset == "water-quality":
            show = show[["date", "station", "river"] + PARAM_KEYS].rename(
                columns={k: k.replace("_mg_l", "").replace("_mpn", "").replace("_us_cm", "").replace("_c", "")
                         for k in PARAM_KEYS})
        data = [list(map(str, show.columns))] + [[str(S.f(v, 3) if isinstance(v, float) else v)[:40] for v in r]
                                                 for r in show.values.tolist()]
        t2 = Table(data, repeatRows=1)
        t2.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTSIZE", (0, 0), (-1, -1), 6.5),
                                ("GRID", (0, 0), (-1, -1), 0.2, colors.lightgrey)]))
        flow.append(t2)
    doc.build(flow)
    return Response(buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{base}.pdf"'})

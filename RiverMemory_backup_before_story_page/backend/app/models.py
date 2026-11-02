from datetime import date, datetime

from sqlalchemy import (Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text,
                        UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=True)


class DataSource(Base):
    __tablename__ = "data_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    organization: Mapped[str | None] = mapped_column(String(200))
    url: Mapped[str | None] = mapped_column(String(500))
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    parameters: Mapped[str | None] = mapped_column(Text)
    units: Mapped[str | None] = mapped_column(Text)
    coverage: Mapped[str | None] = mapped_column(Text)
    data_format: Mapped[str | None] = mapped_column(String(100))
    processing: Mapped[str | None] = mapped_column(Text)
    missing_info: Mapped[str | None] = mapped_column(Text)
    limitations: Mapped[str | None] = mapped_column(Text)
    provenance_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Station(Base):
    __tablename__ = "stations"
    __table_args__ = (UniqueConstraint("name", "river", name="uq_station_name_river"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    river: Mapped[str] = mapped_column(String(50), index=True)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30))
    filename: Mapped[str] = mapped_column(String(255))
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))
    rows_total: Mapped[int] = mapped_column(Integer, default=0)
    rows_imported: Mapped[int] = mapped_column(Integer, default=0)
    rows_duplicate: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    imported_by: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class WaterQuality(Base):
    __tablename__ = "water_quality"
    __table_args__ = (UniqueConstraint("station_id", "date", name="uq_wq_station_date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    ph: Mapped[float | None] = mapped_column(Float)
    do_mg_l: Mapped[float | None] = mapped_column(Float)
    bod_mg_l: Mapped[float | None] = mapped_column(Float)
    cod_mg_l: Mapped[float | None] = mapped_column(Float)
    temperature_c: Mapped[float | None] = mapped_column(Float)
    conductivity_us_cm: Mapped[float | None] = mapped_column(Float)
    nitrate_mg_l: Mapped[float | None] = mapped_column(Float)
    total_coliform_mpn: Mapped[float | None] = mapped_column(Float)
    fecal_coliform_mpn: Mapped[float | None] = mapped_column(Float)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("import_batches.id"))
    station: Mapped[Station] = relationship()


class WaterQualityRange(Base):
    """Annual minimum-maximum range for one parameter at one station.

    Deliberately separate from `water_quality`: a range is NOT a dated reading, so it must never be stored
    with an invented date or fed into time-series, trend or correlation analysis.
    """
    __tablename__ = "water_quality_ranges"
    __table_args__ = (UniqueConstraint("station_id", "year", "parameter", name="uq_wqr_station_year_param"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    station_code: Mapped[str | None] = mapped_column(String(30))   # e.g. CPCB/NWMP station ID "1046"
    year: Mapped[int] = mapped_column(Integer, index=True)
    parameter: Mapped[str] = mapped_column(String(40))             # key from params.PARAMS
    min_value: Mapped[float] = mapped_column(Float)
    max_value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(30))
    unit_original: Mapped[str | None] = mapped_column(String(30))
    value_type: Mapped[str] = mapped_column(String(40), default="min_max_range")
    source_status: Mapped[str | None] = mapped_column(String(200))
    record_ref: Mapped[str | None] = mapped_column(String(30))     # id in the cleaned dataset, e.g. WQ-001
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("import_batches.id"))
    station: Mapped[Station] = relationship()


class Rainfall(Base):
    __tablename__ = "rainfall"
    __table_args__ = (UniqueConstraint("date", "location", "kind", name="uq_rain_date_loc_kind"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    location: Mapped[str] = mapped_column(String(200))
    rainfall_mm: Mapped[float | None] = mapped_column(Float)
    kind: Mapped[str] = mapped_column(String(20), default="gridded")  # gridded | gauge
    resolution: Mapped[str | None] = mapped_column(String(100))
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("import_batches.id"))


class RainfallReferencePoint(Base):
    __tablename__ = "rainfall_reference_points"
    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    point_type: Mapped[str] = mapped_column(String(100))
    note: Mapped[str | None] = mapped_column(Text)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(250))
    incident_date: Mapped[date] = mapped_column(Date, index=True)
    river: Mapped[str | None] = mapped_column(String(50))
    location: Mapped[str | None] = mapped_column(String(250))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    incident_type: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(Text)
    evidence_source: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

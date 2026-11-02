from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

River = Literal["Ganga", "Yamuna", "Confluence"]
Severity = Literal["low", "moderate", "high", "critical"]


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class _Coords(BaseModel):
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)

    @field_validator("longitude")
    @classmethod
    def _pair(cls, v, info):
        if (v is None) != (info.data.get("latitude") is None):
            raise ValueError("latitude and longitude must be provided together")
        return v


class IncidentIn(_Coords):
    title: str = Field(min_length=3, max_length=250)
    incident_date: date
    river: River | None = None
    location: str | None = Field(None, max_length=250)
    incident_type: str = Field(min_length=2, max_length=100)
    severity: Severity | None = None
    description: str | None = Field(None, max_length=5000)
    evidence_source: str | None = Field(None, max_length=500)


class IncidentOut(IncidentIn):
    id: int
    created_by: str | None = None
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class DataSourceIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    organization: str | None = Field(None, max_length=200)
    url: str | None = Field(None, max_length=500)
    period_start: date | None = None
    period_end: date | None = None
    parameters: str | None = None
    units: str | None = None
    coverage: str | None = None
    data_format: str | None = Field(None, max_length=100)
    processing: str | None = None
    missing_info: str | None = None
    limitations: str | None = None
    provenance_verified: bool = False


class DataSourceOut(DataSourceIn):
    id: int
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class StationIn(_Coords):
    name: str = Field(min_length=2, max_length=200)
    river: Literal["Ganga", "Yamuna"]
    source_id: int | None = None


class StationOut(StationIn):
    id: int
    record_count: int = 0
    last_date: date | None = None
    model_config = {"from_attributes": True}

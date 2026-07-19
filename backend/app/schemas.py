from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CarrierSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    usdot_number: str
    mc_number: str | None = None
    legal_name: str | None = None
    dba_name: str | None = None
    city: str | None = None
    state: str | None = None
    operation_type: str | None = None
    total_vehicles: int | None = None
    total_drivers: int | None = None
    safety_rating: str | None = None
    slug: str | None = None


class CarrierDetail(CarrierSummary):
    address: str | None = None
    zip: str | None = None
    phone: str | None = None
    email: str | None = None
    carrier_classification: str | None = None
    authority_status: str | None = None
    duns_number: str | None = None
    is_active: bool
    last_scraped_at: datetime | None = None


class CarrierListResponse(BaseModel):
    items: list[CarrierSummary]
    total: int
    page: int
    per_page: int
    pages: int


class SafetyScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    basic_category: str | None = None
    score: Decimal | None = None
    percentile: int | None = None
    alert_status: str | None = None
    measured_date: date | None = None


class InspectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inspection_date: date | None = None
    inspection_type: str | None = None
    vehicles_inspected: int | None = None
    drivers_inspected: int | None = None
    violations_found: int | None = None
    oos_vehicles: int | None = None
    oos_drivers: int | None = None
    state: str | None = None


class ViolationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    violation_code: str | None = None
    violation_description: str | None = None
    violation_date: date | None = None
    oos_indicator: bool | None = None
    severity_weight: int | None = None


class CarrierSafetyResponse(BaseModel):
    usdot_number: str
    safety_rating: str | None = None
    safety_scores: list[SafetyScoreOut]
    inspections: list[InspectionOut]
    violations: list[ViolationOut]


class ScrapingStartRequest(BaseModel):
    actor: str = Field(
        default="main", pattern="^(main|safety|new)$", description="Which Apify actor to run"
    )
    # Required for actor=main|safety; ignored for actor=new.
    usdot_range_start: int | None = Field(default=None, ge=1)
    usdot_range_end: int | None = Field(default=None, ge=1)
    # main actor only: premium data fields (emails, crash history, safety ratings).
    premium: bool = False
    # new actor only: how far back to look for newly added carriers.
    days_back: int = Field(default=7, ge=1, le=90)


class ScrapingJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: str
    apify_run_id: str | None = None
    status: str
    usdot_range_start: int | None = None
    usdot_range_end: int | None = None
    total_records: int | None = None
    processed_records: int
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

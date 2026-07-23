from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


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


class MonthlyCount(BaseModel):
    month: str  # YYYY-MM
    count: int


class CarrierSafetyResponse(BaseModel):
    usdot_number: str
    safety_rating: str | None = None
    safety_scores: list[SafetyScoreOut]
    inspections: list[InspectionOut]
    violations: list[ViolationOut]
    inspections_total: int = 0
    violations_total: int = 0
    inspections_monthly: list[MonthlyCount] = []


class StatsResponse(BaseModel):
    total_carriers: int
    total_inspections: int
    total_violations: int
    total_safety_scores: int
    scored_carriers: int
    carriers_with_alerts: int
    states: int


class StateCount(BaseModel):
    state: str
    count: int


class UpdatesResponse(BaseModel):
    new_carriers_this_week: int | None = None
    inspections_month: str | None = None
    inspections_last_month: int = 0

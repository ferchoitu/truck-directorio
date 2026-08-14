from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Carrier(Base):
    __tablename__ = "carriers"

    id: Mapped[int] = mapped_column(primary_key=True)
    usdot_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    mc_number: Mapped[str | None] = mapped_column(String(20), index=True)
    legal_name: Mapped[str | None] = mapped_column(String(255), index=True)
    dba_name: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(10), index=True)
    zip: Mapped[str | None] = mapped_column(String(20))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    operation_type: Mapped[str | None] = mapped_column(String(100), index=True)
    carrier_classification: Mapped[str | None] = mapped_column(String(100))
    total_vehicles: Mapped[int | None] = mapped_column(Integer)
    total_drivers: Mapped[int | None] = mapped_column(Integer)
    authority_status: Mapped[str | None] = mapped_column(String(50))
    safety_rating: Mapped[str | None] = mapped_column(String(50), index=True)
    duns_number: Mapped[str | None] = mapped_column(String(20))
    slug: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    last_scraped_at: Mapped[datetime | None] = mapped_column(DateTime)

    safety_scores: Mapped[list["SafetyScore"]] = relationship(
        back_populates="carrier", cascade="all, delete-orphan"
    )
    inspections: Mapped[list["Inspection"]] = relationship(
        back_populates="carrier", cascade="all, delete-orphan"
    )
    violations: Mapped[list["Violation"]] = relationship(
        back_populates="carrier", cascade="all, delete-orphan"
    )


class SafetyScore(Base):
    __tablename__ = "safety_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(
        ForeignKey("carriers.id", ondelete="CASCADE"), index=True
    )
    basic_category: Mapped[str | None] = mapped_column(String(100))
    # (8,2), not (5,2): SMS utilization-adjusted measures exceed 999.99 for
    # tiny fleets, and the narrower type made the monthly reingest overflow
    # (migration 0005).
    score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    percentile: Mapped[int | None] = mapped_column(Integer)
    alert_status: Mapped[str | None] = mapped_column(String(20))
    measured_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    carrier: Mapped[Carrier] = relationship(back_populates="safety_scores")


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(
        ForeignKey("carriers.id", ondelete="CASCADE"), index=True
    )
    inspection_date: Mapped[date | None] = mapped_column(Date)
    inspection_type: Mapped[str | None] = mapped_column(String(100))
    vehicles_inspected: Mapped[int | None] = mapped_column(Integer)
    drivers_inspected: Mapped[int | None] = mapped_column(Integer)
    violations_found: Mapped[int | None] = mapped_column(Integer)
    oos_vehicles: Mapped[int | None] = mapped_column(Integer)
    oos_drivers: Mapped[int | None] = mapped_column(Integer)
    state: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    carrier: Mapped[Carrier] = relationship(back_populates="inspections")


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrier_id: Mapped[int] = mapped_column(
        ForeignKey("carriers.id", ondelete="CASCADE"), index=True
    )
    violation_code: Mapped[str | None] = mapped_column(String(20))
    violation_description: Mapped[str | None] = mapped_column(Text)
    violation_date: Mapped[date | None] = mapped_column(Date)
    oos_indicator: Mapped[bool | None] = mapped_column(Boolean)
    severity_weight: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    carrier: Mapped[Carrier] = relationship(back_populates="violations")


class Subscriber(Base):
    """A paying API customer, mirrored from Paddle subscription webhooks."""

    __tablename__ = "subscribers"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    plan: Mapped[str] = mapped_column(String(20), default="growth")
    # active | past_due | paused | canceled — mirrors Paddle's subscription status.
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)

    paddle_customer_id: Mapped[str | None] = mapped_column(String(64), index=True)
    paddle_subscription_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True
    )

    # Only the SHA-256 of the API key is stored. The plaintext is shown once, at
    # issue time, and is unrecoverable afterwards — losing it means rotating.
    api_key_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    api_key_prefix: Mapped[str | None] = mapped_column(String(20))
    api_key_issued_at: Mapped[datetime | None] = mapped_column(DateTime)

    monthly_quota: Mapped[int] = mapped_column(Integer, default=50000)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    usage_period_start: Mapped[date | None] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    usdot_range_start: Mapped[int | None] = mapped_column(Integer)
    usdot_range_end: Mapped[int | None] = mapped_column(Integer)
    total_records: Mapped[int | None] = mapped_column(Integer)
    processed_records: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

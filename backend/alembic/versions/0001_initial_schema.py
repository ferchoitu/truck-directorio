"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "carriers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usdot_number", sa.String(20), nullable=False),
        sa.Column("mc_number", sa.String(20)),
        sa.Column("legal_name", sa.String(255)),
        sa.Column("dba_name", sa.String(255)),
        sa.Column("address", sa.Text()),
        sa.Column("city", sa.String(100)),
        sa.Column("state", sa.String(10)),
        sa.Column("zip", sa.String(20)),
        sa.Column("phone", sa.String(50)),
        sa.Column("email", sa.String(255)),
        sa.Column("operation_type", sa.String(100)),
        sa.Column("carrier_classification", sa.String(100)),
        sa.Column("total_vehicles", sa.Integer()),
        sa.Column("total_drivers", sa.Integer()),
        sa.Column("authority_status", sa.String(50)),
        sa.Column("safety_rating", sa.String(50)),
        sa.Column("duns_number", sa.String(20)),
        sa.Column("slug", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_scraped_at", sa.DateTime()),
        sa.UniqueConstraint("usdot_number"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_carriers_usdot_number", "carriers", ["usdot_number"])
    op.create_index("ix_carriers_mc_number", "carriers", ["mc_number"])
    op.create_index("ix_carriers_legal_name", "carriers", ["legal_name"])
    op.create_index("ix_carriers_state", "carriers", ["state"])
    op.create_index("ix_carriers_operation_type", "carriers", ["operation_type"])
    op.create_index("ix_carriers_safety_rating", "carriers", ["safety_rating"])
    op.create_index("ix_carriers_slug", "carriers", ["slug"])

    op.create_table(
        "safety_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "carrier_id",
            sa.Integer(),
            sa.ForeignKey("carriers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("basic_category", sa.String(100)),
        sa.Column("score", sa.Numeric(5, 2)),
        sa.Column("percentile", sa.Integer()),
        sa.Column("alert_status", sa.String(20)),
        sa.Column("measured_date", sa.Date()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_safety_scores_carrier_id", "safety_scores", ["carrier_id"])

    op.create_table(
        "inspections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "carrier_id",
            sa.Integer(),
            sa.ForeignKey("carriers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("inspection_date", sa.Date()),
        sa.Column("inspection_type", sa.String(100)),
        sa.Column("vehicles_inspected", sa.Integer()),
        sa.Column("drivers_inspected", sa.Integer()),
        sa.Column("violations_found", sa.Integer()),
        sa.Column("oos_vehicles", sa.Integer()),
        sa.Column("oos_drivers", sa.Integer()),
        sa.Column("state", sa.String(10)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_inspections_carrier_id", "inspections", ["carrier_id"])

    op.create_table(
        "violations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "carrier_id",
            sa.Integer(),
            sa.ForeignKey("carriers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("violation_code", sa.String(20)),
        sa.Column("violation_description", sa.Text()),
        sa.Column("violation_date", sa.Date()),
        sa.Column("oos_indicator", sa.Boolean()),
        sa.Column("severity_weight", sa.Integer()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_violations_carrier_id", "violations", ["carrier_id"])

    op.create_table(
        "scraping_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_id", sa.String(100), nullable=False),
        sa.Column("apify_run_id", sa.String(100)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("usdot_range_start", sa.Integer()),
        sa.Column("usdot_range_end", sa.Integer()),
        sa.Column("total_records", sa.Integer()),
        sa.Column("processed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_scraping_jobs_apify_run_id", "scraping_jobs", ["apify_run_id"])


def downgrade() -> None:
    op.drop_table("scraping_jobs")
    op.drop_table("violations")
    op.drop_table("inspections")
    op.drop_table("safety_scores")
    op.drop_table("carriers")

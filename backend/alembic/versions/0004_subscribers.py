"""Add subscribers table for Paddle-backed API plans."""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subscribers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(20), nullable=False, server_default="growth"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("paddle_customer_id", sa.String(64)),
        sa.Column("paddle_subscription_id", sa.String(64), nullable=False),
        sa.Column("api_key_hash", sa.String(64)),
        sa.Column("api_key_prefix", sa.String(20)),
        sa.Column("api_key_issued_at", sa.DateTime()),
        sa.Column("monthly_quota", sa.Integer(), nullable=False, server_default="50000"),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("usage_period_start", sa.Date()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_subscribers_email", "subscribers", ["email"])
    op.create_index("ix_subscribers_status", "subscribers", ["status"])
    op.create_index(
        "ix_subscribers_paddle_customer_id", "subscribers", ["paddle_customer_id"]
    )
    op.create_index(
        "ix_subscribers_paddle_subscription_id",
        "subscribers",
        ["paddle_subscription_id"],
        unique=True,
    )
    op.create_index(
        "ix_subscribers_api_key_hash", "subscribers", ["api_key_hash"], unique=True
    )


def downgrade() -> None:
    op.drop_table("subscribers")

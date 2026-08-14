"""Widen safety_scores.score from numeric(5,2) to numeric(8,2)

The August 2026 SMS snapshot carries BASIC measures above 999.99 — the
utilization-adjusted formula produces huge values for one-truck fleets — and
numeric(5,2) made the monthly reingest die with a numeric field overflow in
the chunk covering DOT 4.4M-4.6M. Increasing precision at equal scale is a
metadata-only change: no table rewrite, safe on live data.

Revision ID: 0005
Revises: 0004
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE safety_scores ALTER COLUMN score TYPE numeric(8,2)")


def downgrade() -> None:
    # Would raise on any value >= 1000, which is exactly the data that
    # motivated the change — narrowing back is not a supported path.
    op.execute("ALTER TABLE safety_scores ALTER COLUMN score TYPE numeric(5,2)")

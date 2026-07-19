"""pg_trgm indexes for name search at scale

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-19

"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_carriers_legal_name_trgm "
        "ON carriers USING gin (legal_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_carriers_dba_name_trgm "
        "ON carriers USING gin (dba_name gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_carriers_dba_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_carriers_legal_name_trgm")

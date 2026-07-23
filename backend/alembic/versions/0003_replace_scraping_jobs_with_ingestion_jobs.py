"""Replace legacy paid-scraping job tracking with official-source ingestion jobs."""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_scraping_jobs_apify_run_id", table_name="scraping_jobs")
    op.drop_column("scraping_jobs", "apify_run_id")
    op.alter_column("scraping_jobs", "actor_id", new_column_name="source")
    op.rename_table("scraping_jobs", "ingestion_jobs")
    op.create_index("ix_ingestion_jobs_source", "ingestion_jobs", ["source"])


def downgrade() -> None:
    op.drop_index("ix_ingestion_jobs_source", table_name="ingestion_jobs")
    op.rename_table("ingestion_jobs", "scraping_jobs")
    op.alter_column("scraping_jobs", "source", new_column_name="actor_id")
    op.add_column("scraping_jobs", sa.Column("apify_run_id", sa.String(length=100)))
    op.create_index("ix_scraping_jobs_apify_run_id", "scraping_jobs", ["apify_run_id"])

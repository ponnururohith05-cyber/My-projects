"""Create users and job applications.

Revision ID: 0001_initial
Revises:
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_table(
        "job_applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('Applied', 'Interview', 'Offer', 'Rejected')",
            name="ck_job_applications_status",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_job_applications_user_id_users", ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_job_applications_user_created_at",
        "job_applications",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_job_applications_company_trgm",
        "job_applications",
        ["company"],
        postgresql_using="gin",
        postgresql_ops={"company": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_job_applications_role_trgm",
        "job_applications",
        ["role"],
        postgresql_using="gin",
        postgresql_ops={"role": "gin_trgm_ops"},
    )
    op.create_index("ix_job_applications_status", "job_applications", ["status"])


def downgrade() -> None:
    op.drop_index("ix_job_applications_status", table_name="job_applications")
    op.drop_index("ix_job_applications_role_trgm", table_name="job_applications")
    op.drop_index("ix_job_applications_company_trgm", table_name="job_applications")
    op.drop_index(
        "ix_job_applications_user_created_at", table_name="job_applications"
    )
    op.drop_table("job_applications")
    op.drop_table("users")

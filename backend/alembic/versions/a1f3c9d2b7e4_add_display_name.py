"""add display_name to users

Revision ID: a1f3c9d2b7e4
Revises: 8598c2b69970
Create Date: 2026-11-09 16:10:00
"""

import sqlalchemy as sa
from alembic import op

revision = "a1f3c9d2b7e4"
down_revision = "8598c2b69970"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "display_name")

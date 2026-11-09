"""add confirmed to entries (the user checked what the AI was unsure about)

Revision ID: d9a4c6e12b73
Revises: c5e8a1f30d92
Create Date: 2026-11-09 23:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "d9a4c6e12b73"
down_revision = "c5e8a1f30d92"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entries",
        sa.Column("confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("entries", "confirmed")

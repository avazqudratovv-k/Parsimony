"""add group_id to entries (items of one purchase share it)

Revision ID: c5e8a1f30d92
Revises: b7d2e9a41c58
Create Date: 2026-11-09 22:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "c5e8a1f30d92"
down_revision = "b7d2e9a41c58"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("entries", sa.Column("group_id", sa.Uuid(), nullable=True))


def downgrade() -> None:
    op.drop_column("entries", "group_id")

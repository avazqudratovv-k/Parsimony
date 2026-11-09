"""add merchant_domain to entries (for logos, empty until logos are switched on)

Revision ID: b7d2e9a41c58
Revises: a1f3c9d2b7e4
Create Date: 2026-11-09 21:30:00
"""

import sqlalchemy as sa
from alembic import op

revision = "b7d2e9a41c58"
down_revision = "a1f3c9d2b7e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("entries", sa.Column("merchant_domain", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("entries", "merchant_domain")

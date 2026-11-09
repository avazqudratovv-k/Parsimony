"""Import every model here so Base.metadata knows about all tables (Alembic relies on this)."""

from app.models.attachment import Attachment
from app.models.entry import Entry
from app.models.eval_run import EvalRun
from app.models.usage_counter import UsageCounter
from app.models.user import User

__all__ = ["Attachment", "Entry", "EvalRun", "UsageCounter", "User"]

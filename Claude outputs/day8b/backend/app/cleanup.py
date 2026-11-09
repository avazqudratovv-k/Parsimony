"""Delete expired demo accounts. Run from cron:

docker compose exec -T backend python -m app.cleanup
"""

from app.db import get_session_factory
from app.services import demo_service


def main() -> None:
    with get_session_factory()() as db:
        removed = demo_service.delete_expired_demo_users(db)
    print(f"Deleted {removed} expired demo account(s)")


if __name__ == "__main__":
    main()

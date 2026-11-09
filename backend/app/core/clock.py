import datetime as dt


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def as_utc(value: dt.datetime) -> dt.datetime:
    """SQLite hands back naive datetimes; Postgres hands back aware ones. Treat naive as UTC."""
    return value.replace(tzinfo=dt.UTC) if value.tzinfo is None else value

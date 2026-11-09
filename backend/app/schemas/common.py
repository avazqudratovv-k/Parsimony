from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def validate_timezone(value: str | None) -> str | None:
    """Accept None or an IANA name such as "Asia/Seoul"."""
    if value is None:
        return None
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("unknown timezone") from None
    return value

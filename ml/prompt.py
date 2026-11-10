"""The short prompt the small model sees, and the code around it. Training and evaluation share it.

The API model gets the long prompt in backend/app/ai/prompts.py. A small fine-tuned model does
not need the rules spelled out: it learns them from examples, so the prompt is just the context.

Dates are NOT computed by the model. Small models are bad at calendar arithmetic, so the model
copies what the person wrote into a short code and plain code turns it into a date:
    "0"    today, or no date mentioned        "-3"   three days ago ("yesterday" is "-1")
    "d5"   the 5th of this month              "fri"  the most recent Friday (never today)
"""

import datetime as dt
import json
import re

FIELDS = [
    "when",
    "merchant",
    "note",
    "amount",
    "currency",
    "category",
    "payment_method",
    "items",
]
CATEGORIES = {
    "food_drink",
    "groceries",
    "transport",
    "shopping",
    "bills",
    "health",
    "entertainment",
    "travel",
    "other",
}
WEEKDAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def make_prompt(text: str, today: dt.date, default_currency: str) -> str:
    return (
        f"Today: {today.isoformat()} ({today.strftime('%A')}). Default currency: {default_currency}.\n"
        f"Expense: {text}\n"
        "JSON:"
    )


def make_completion(out: dict) -> str:
    """Compact JSON in a fixed key order (the model learns one shape, so it is easy to parse)."""
    ordered = {k: out.get(k) for k in FIELDS if k != "items"}
    if out.get("items"):
        ordered["items"] = out["items"]
    return json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))


def resolve_when(code, today: dt.date) -> dt.date:
    """Turns the model's date code into a date. Anything unreadable means today."""
    code = str(code or "0").strip().lower()
    try:
        if re.fullmatch(r"-\d{1,3}", code):
            return today - dt.timedelta(days=int(code[1:]))
        if m := re.fullmatch(r"d(\d{1,2})", code):
            day = int(m.group(1))
            if day <= today.day:
                return today.replace(day=day)
            prev = today.replace(day=1) - dt.timedelta(
                days=1
            )  # "the 30th" said on the 5th
            return prev.replace(day=day)
        if code in WEEKDAY_CODES:
            delta = (today.weekday() - WEEKDAY_CODES.index(code)) % 7 or 7
            return today - dt.timedelta(days=delta)
    except ValueError:
        pass
    return today


def when_code_for(date: dt.date, today: dt.date) -> str:
    """Offset code for a date that is known to be 0-6 days back (used to convert old labels)."""
    n = (today - date).days
    return "0" if n == 0 else f"-{n}"


def finalize(out: dict | None, today: dt.date) -> dict | None:
    """Model answer -> the fields the app uses: date from the code, category checked against the list."""
    if out is None:
        return None
    out = dict(out)
    out["date"] = resolve_when(out.pop("when", None), today).isoformat()
    if out.get("category") not in CATEGORIES:
        out["category"] = "other"
    for item in out.get("items") or []:
        if isinstance(item, dict) and item.get("category") not in CATEGORIES:
            item["category"] = "other"
    return out

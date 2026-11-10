"""The short prompt the small model sees. Training and evaluation both import this, so they match.

The API model gets the long prompt in backend/app/ai/prompts.py. A small fine-tuned model does
not need the rules spelled out: it learns them from examples, so the prompt is just the context.
"""

import datetime as dt
import json

FIELDS = [
    "date",
    "merchant",
    "note",
    "amount",
    "currency",
    "category",
    "payment_method",
    "items",
]


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

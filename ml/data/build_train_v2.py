"""Round 2 training data: labels first, Gemini writes the wording.

Why: round 1 used my own templates, so the small model learned the templates, not real typing
(45% on the test set). Here the label is decided by code (category, amount, currency, payment,
date, merchant, items) and Gemini only writes how a person might type it: slang, typos, short
forms like 4만8천원 or 85 ming. The label stays correct by construction; the wording gets real.

Run on your own machine (key stays local). It only needs `pip install google-genai`:

    GEMINI_API_KEY=... python ml/data/build_train_v2.py --calls 180
    python ml/data/build_train_v2.py --assemble-only        # rebuild train_v2.jsonl from the cache

It is resumable: every call is cached in ml/data/raw_v2/, so a crash or a rate limit just means
"run it again". ~180 calls x 20 messages = ~3,600 messages, about 25-35 minutes (paced).
`--fake` skips the API and writes placeholder wording, only to test the code.

Safety: any message identical to a test sentence is dropped, and so is any message whose written
amount cannot be matched to the label. Category conventions follow my own labeling choices.
"""

import argparse
import datetime as dt
import json
import os
import random
import re
import sys
import time
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from prompt import make_completion, make_prompt, resolve_when, when_code_for

RAW = ML / "data" / "raw_v2"
OUT = ML / "data" / "train_v3.jsonl"
MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
PER_CALL = 20
LANG_CYCLE = [
    "en",
    "ko",
    "uz",
    "en",
    "ko",
    "uz",
    "uz",
]  # Uzbek is the weakest, so it gets more
LANG_NAME = {"en": "English", "ko": "Korean", "uz": "Uzbek (Latin script)"}

CAT_HINT = {
    "food_drink": "meals, coffee, drinks, snacks, delivery, restaurants",
    "groceries": "supermarket, market or convenience-store food and household basics",
    "transport": "bus, subway, taxi, fuel, parking, tolls",
    "shopping": "clothes, electronics, books, cosmetics, household goods",
    "bills": "rent, utilities, phone, internet, subscriptions, insurance",
    "health": "doctor, pharmacy, dentist, gym, glasses",
    "entertainment": "movies, games, concerts, streaming, hobbies",
    "travel": "flights, hotels, intercity trains, tours",
    "other": "gifts, donations, fees, services, anything that fits no other category",
}
KRW_RANGE = {  # typical single purchase, in won
    "food_drink": (2500, 90000),
    "groceries": (1500, 150000),
    "transport": (1250, 60000),
    "shopping": (5000, 400000),
    "bills": (15000, 800000),
    "health": (3000, 250000),
    "entertainment": (5000, 150000),
    "travel": (30000, 900000),
    "other": (5000, 300000),
}
MERCHANTS = {  # (name as written, category)
    "en": [
        ("Starbucks", "food_drink"),
        ("Emart", "groceries"),
        ("Coupang", "shopping"),
        ("Netflix", "entertainment"),
        ("Uber", "transport"),
        ("Olive Young", "shopping"),
        ("CU", "groceries"),
        ("Baemin", "food_drink"),
        ("Spotify", "entertainment"),
        ("Daiso", "shopping"),
        ("Lotte Mart", "groceries"),
        ("Kakao T", "transport"),
    ],
    "ko": [
        ("스타벅스", "food_drink"),
        ("이마트", "groceries"),
        ("쿠팡", "shopping"),
        ("넷플릭스", "entertainment"),
        ("올리브영", "shopping"),
        ("GS25", "groceries"),
        ("배달의민족", "food_drink"),
        ("다이소", "shopping"),
        ("롯데마트", "groceries"),
        ("카카오택시", "transport"),
        ("CU", "groceries"),
        ("맥도날드", "food_drink"),
    ],
    "uz": [
        ("Korzinka", "groceries"),
        ("Makro", "groceries"),
        ("Yandex Go", "transport"),
        ("Uzum", "shopping"),
        ("Evos", "food_drink"),
        ("Netflix", "entertainment"),
        ("Starbucks", "food_drink"),
        ("Oqtepa Lavash", "food_drink"),
        ("Click", "bills"),
        ("Beeline", "bills"),
        ("Artel", "shopping"),
        ("GS25", "groceries"),
    ],
}
PAYMENTS = (
    ["unknown"] * 35
    + ["card"] * 30
    + ["cash"] * 16
    + ["transfer"] * 8
    + ["mobile"] * 11
)
PAY_TEXT = {
    "card": "paid by card",
    "cash": "paid in cash",
    "transfer": "paid by bank transfer",
    "mobile": "paid with a mobile wallet/app (Kakao Pay, Samsung Pay, Click, Payme...)",
    "unknown": "payment method NOT mentioned",
}
WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]
UZS_RANGE = {  # local prices in so'm (a bus ride is ~1,400; the won table would make it 11,000)
    "food_drink": (8000, 250000),
    "groceries": (3000, 500000),
    "transport": (1400, 80000),
    "shopping": (50000, 1500000),
    "bills": (30000, 1500000),
    "health": (10000, 500000),
    "entertainment": (20000, 400000),
    "travel": (100000, 3000000),
    "other": (10000, 500000),
}
RATES = {"KRW": 1, "USD": 1 / 1400, "EUR": 1 / 1500, "UZS": 9}


def convert(krw: int, cur: str, rng) -> float | int:
    v = krw * RATES[cur]
    if cur in ("USD", "EUR"):
        return round(
            round(v * 2) / 2 + rng.choice([0, 0, 0.99, -0.01 if v > 2 else 0]), 2
        )
    step = (
        500
        if cur == "UZS"
        else (100 if krw < 20000 else 1000 if krw < 300000 else 5000)
    )
    return max(step, round(v / step) * step)


def pick_amount(cat: str, cur: str, rng) -> float | int:
    if cur == "UZS":
        lo, hi = UZS_RANGE[cat]
        v = int(lo * (hi / lo) ** (rng.random() ** 1.6))
        step = 100 if v < 10000 else 500 if v < 100000 else 5000
        return max(step, round(v / step) * step)
    lo, hi = KRW_RANGE[cat]
    krw = int(
        lo * (hi / lo) ** (rng.random() ** 1.6)
    )  # skewed towards cheaper purchases
    return convert(krw, cur, rng)


def pick_when(today: dt.date, rng):
    """Returns (instruction for Gemini, resulting date)."""
    kind = rng.choices(
        ["none", "today", "yesterday", "ago", "dom", "weekday"],
        [30, 12, 20, 12, 10, 16],
    )[0]
    if kind == "dom" and today.day < 3:
        kind = "none"
    if kind == "none":
        return "do NOT mention any date", today
    if kind == "today":
        return 'say it was today (e.g. "this morning", "just now", "today")', today
    if kind == "yesterday":
        return "say it was yesterday", today - dt.timedelta(days=1)
    if kind == "ago":
        n = rng.randint(2, 6)
        return f"say it was {n} days ago", today - dt.timedelta(days=n)
    if kind == "dom":
        d = rng.randint(1, today.day - 1)
        return (
            f"say it was on the {d}th of this month (just the day number, like 'on the {d}th')",
            today.replace(day=d),
        )
    w = rng.randrange(7)
    delta = (today.weekday() - w) % 7 or 7
    return (
        f"say it was on {WEEKDAYS[w]} (the most recent one, e.g. 'last {WEEKDAYS[w]}' or 'on {WEEKDAYS[w]}')",
        today - dt.timedelta(days=delta),
    )


def make_spec(lang: str, rng: random.Random) -> dict:
    today = dt.date(2026, 1, 3) + dt.timedelta(days=rng.randint(0, 330))
    default = rng.choice(
        {
            "en": ["KRW", "USD", "KRW"],
            "ko": ["KRW"] * 5 + ["USD"],
            "uz": ["UZS", "UZS", "KRW", "USD"],
        }[lang]
    )
    kind = rng.choices(
        ["single", "merchant", "multi", "mixed", "samecat", "none"],
        [48, 15, 12, 6, 8, 6],
    )[0]
    cur = (
        default
        if rng.random() < 0.8
        else rng.choice([c for c in RATES if c != default])
    )
    spec = {
        "lang": lang,
        "kind": kind,
        "today": today.isoformat(),
        "default": default,
        "cur": cur,
    }
    if kind == "none":
        return spec
    instr, date = pick_when(today, rng)
    spec.update(
        when=instr,
        date=date.isoformat(),
        say_cur=(cur != default) or rng.random() < 0.4,
    )
    if kind in ("single", "merchant"):
        merchant = None
        cat = rng.choice(list(CAT_HINT))
        if kind == "merchant":
            merchant, cat = rng.choice(MERCHANTS[lang])
        spec.update(
            cat=cat,
            amount=pick_amount(cat, cur, rng),
            pay=rng.choice(PAYMENTS),
            merchant=merchant,
        )
    elif kind == "multi":
        cats = rng.sample(list(CAT_HINT), rng.choice([2, 2, 3]))
        pays = [rng.choice(PAYMENTS)] * len(cats)
        if rng.random() < 0.3:
            pays = [rng.choice(["card", "cash", "transfer", "mobile"]) for _ in cats]
        spec["items"] = [
            {"cat": c, "amount": pick_amount(c, cur, rng), "pay": p}
            for c, p in zip(cats, pays, strict=True)
        ]
        if len({round(i["amount"], 2) for i in spec["items"]}) < len(
            cats
        ):  # avoid a tie for "biggest"
            return make_spec(lang, rng)
    elif (
        kind == "mixed"
    ):  # two things bought in two currencies, each with its own currency
        cats = rng.sample(
            ["shopping", "food_drink", "groceries", "entertainment", "travel"], 2
        )
        curs = rng.sample([default] + [c for c in RATES if c != default], 2)
        pays = [rng.choice(["card", "cash", "transfer", "mobile"]) for _ in cats]
        spec["items"] = [
            {"cat": c, "amount": pick_amount(c, cu, rng), "pay": p, "cur": cu}
            for c, cu, p in zip(cats, curs, pays, strict=True)
        ]
        spec["cur"] = curs[0]
    else:  # samecat: one purchase listing several things of the same category -> NO split
        cat = rng.choice(["food_drink", "groceries", "shopping", "health"])
        n = rng.choice([2, 2, 3])
        spec.update(
            cat=cat,
            pay=rng.choice(PAYMENTS),
            parts=[pick_amount(cat, cur, rng) for _ in range(n)],
        )
    return spec


def num(x) -> str:
    return f"{x:g}" if isinstance(x, float) else str(x)


def describe(i: int, s: dict) -> str:
    cur_note = (
        f"mention the currency ({s['cur']}) in some natural way"
        if s.get("say_cur")
        else f"do NOT name the currency (user's default is {s['default']}, so it is implied)"
    )
    k = s["kind"]
    if k == "none":
        return f"{i}. NOT_AN_EXPENSE: write something that is not a recordable expense (greeting, question, to-do, chat, or a purchase with no price at all)"
    if k in ("single", "merchant"):
        m = (
            f'merchant "{s["merchant"]}" (write the name exactly like this)'
            if s["merchant"]
            else "no merchant name (describe what was bought; choose a specific, realistic item)"
        )
        return f"{i}. SINGLE category={s['cat']} amount={num(s['amount'])} {s['cur']} ({cur_note}); {PAY_TEXT[s['pay']]}; date: {s['when']}; {m}"
    if k == "mixed":
        its = "; ".join(
            f"item{j + 1}: category={it['cat']} amount={num(it['amount'])} {it['cur']} (write this currency next to it), {PAY_TEXT[it['pay']]}"
            for j, it in enumerate(s["items"])
        )
        return f"{i}. MIXED_CURRENCY one outing with two purchases in different currencies, in this order: {its}; date: {s['when']}"
    if k == "multi":
        its = "; ".join(
            f"item{j + 1}: category={it['cat']} amount={num(it['amount'])} {s['cur']}, {PAY_TEXT[it['pay']]}"
            for j, it in enumerate(s["items"])
        )
        return f"{i}. MULTI one shopping trip, mention the items in this order, each with its own price: {its}; ({cur_note}); date: {s['when']}"
    parts = ", ".join(num(p) for p in s["parts"])
    return f"{i}. SAME_CATEGORY_LIST category={s['cat']} several different things from one purchase, prices {parts} {s['cur']} (each with its own price; {cur_note}); {PAY_TEXT[s['pay']]}; date: {s['when']}"


def build_prompt(lang: str, specs: list[dict]) -> str:
    lines = "\n".join(describe(i + 1, s) for i, s in enumerate(specs))
    return f"""You write realistic messages that people type into an expense-tracker app, in {LANG_NAME[lang]}.
Write ONE message for each numbered spec below.

Style rules:
- Sound like a real person typing fast: short, informal, sometimes lowercase, a typo in about 1 message in 10, no full sentences needed.
- Vary the word order and the amount style across messages. Use the way real {LANG_NAME[lang]} speakers write money: digits with or without commas, short forms (like 4만8천원, 12k, 85 ming), words like "won", "$", "so'm", symbols.
- The amount in the message must equal the spec exactly. Never change or round it.
- Follow each spec exactly: category, payment, date, merchant. Do not add anything the spec does not say (no extra dates, no payment method if it says NOT mentioned).
- Choose a different, specific item each time. Do not repeat items within this batch.
- Never put the category name in the message.
Specs:
{lines}

Return a JSON array with exactly {len(specs)} objects, in the same order: {{"text": the message, "notes": [short item names]}}.
notes: for SINGLE one name (what was bought, 1-3 words, in the message's language, lowercase); for MULTI one name per item in order; otherwise [].
"""


def when_code(s: dict) -> str:
    """The date code the model should write, read back from the instruction given to Gemini."""
    w, today = s["when"], dt.date.fromisoformat(s["today"])
    if w.startswith("do NOT") or " today" in w:
        code = "0"
    elif "yesterday" in w:
        code = "-1"
    elif m := re.search(r"(\d+) days ago", w):
        code = f"-{m.group(1)}"
    elif m := re.search(r"on the (\d+)th", w):
        code = f"d{m.group(1)}"
    else:
        day = next(d for d in WEEKDAYS if d in w)
        code = day[:3].lower()
    assert resolve_when(code, today).isoformat() == s["date"], (
        code,
        s,
    )  # code and label agree
    return code


def clean(x):
    return int(x) if float(x) == int(x) else round(float(x), 2)


def label_for(s: dict, notes: list[str]) -> dict:
    out = _label_for(s, notes)
    out["amount"] = clean(out["amount"])
    for it in out.get("items", []):
        it["amount"] = clean(it["amount"])
    return out


def _label_for(s: dict, notes: list[str]) -> dict:
    base = {
        "when": "0",
        "merchant": None,
        "note": None,
        "amount": 0,
        "currency": s["default"],
        "category": "other",
        "payment_method": "unknown",
    }
    k = s["kind"]
    if k == "none":
        return base
    base.update(when=when_code(s), currency=s["cur"])
    if k in ("single", "merchant"):
        base.update(
            merchant=s["merchant"],
            note=None if s["merchant"] else (notes[0] if notes else None),
            amount=s["amount"],
            category=s["cat"],
            payment_method=s["pay"],
        )
    elif k == "multi":
        big = max(s["items"], key=lambda it: it["amount"])
        pays = {it["pay"] for it in s["items"]}
        items = []
        for it, n in zip(s["items"], notes, strict=True):
            row = {"note": n, "amount": it["amount"], "category": it["cat"]}
            if len(pays) > 1:
                row["payment_method"] = it["pay"]
            items.append(row)
        base.update(
            amount=round(sum(it["amount"] for it in s["items"]), 2),
            category=big["cat"],
            payment_method=big["pay"],
            items=items,
        )
    elif (
        k == "mixed"
    ):  # amounts are in different currencies: top level = the biggest item's
        big = max(s["items"], key=lambda it: it["amount"] * RATES[it["cur"]] ** -1)
        items = [
            {
                "note": n,
                "amount": it["amount"],
                "category": it["cat"],
                "currency": it["cur"],
                "payment_method": it["pay"],
            }
            for it, n in zip(s["items"], notes, strict=True)
        ]
        base.update(
            amount=big["amount"],
            currency=big["cur"],
            category=big["cat"],
            payment_method=big["pay"],
            items=items,
        )
    else:
        base.update(
            amount=round(sum(s["parts"]), 2), category=s["cat"], payment_method=s["pay"]
        )
    return base


def amounts_of(s: dict) -> list:
    k = s["kind"]
    if k == "none":
        return []
    if k in ("single", "merchant"):
        return [s["amount"]]
    if k in ("multi", "mixed"):
        return [it["amount"] for it in s["items"]]
    return s["parts"]


UNIT_WORDS = re.compile(
    r"만|천|ming|million|mln|mlн|\bk\b|\d\s*k\b|ming|yuz|mingta", re.IGNORECASE
)


def plausible(text: str, s: dict) -> bool:
    """Is every amount in the label visible in the text (as written, or as a short form)?"""
    if s["kind"] == "none":
        return not re.search(
            r"\d{3,}", text
        )  # a 'no expense' message must not carry a price
    nums = set()
    for m in re.finditer(r"\d[\d,. ]*\d|\d", text):
        raw = m.group().strip().rstrip(".,")
        for cleaned in (
            raw.replace(",", "").replace(" ", ""),
            raw.replace(" ", "").replace(",", "."),
        ):
            try:
                nums.add(float(cleaned))
            except ValueError:
                pass
    if not nums:
        return False
    for a in amounts_of(s):
        ok = any(
            abs(n - a) < 0.006
            or abs(n * 1000 - a) < 0.006
            or abs(n * 10000 - a) < 0.006
            or abs(n * 1_000_000 - a) < 0.006
            or abs(n - a / 1000) < 0.006
            for n in nums
        )
        # short forms like 4만8천 are several numbers; accept them only when a unit word is present
        if not ok and not (UNIT_WORDS.search(text) and any(0 < n <= a for n in nums)):
            return False
    return True


def specs_for_call(idx: int) -> tuple[str, list[dict]]:
    lang = LANG_CYCLE[idx % len(LANG_CYCLE)]
    rng = random.Random(f"v2-{idx}")
    return lang, [make_spec(lang, rng) for _ in range(PER_CALL)]


def call_gemini(client, types, prompt: str):
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "notes": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["text", "notes"],
        },
    }
    err = ""
    for attempt in range(5):
        try:
            r = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=schema,
                    max_output_tokens=6000,
                ),
            )
            return json.loads(r.text), ""
        except Exception as exc:  # noqa: BLE001
            code = getattr(exc, "code", None)
            err = f"{type(exc).__name__} {code}: {str(exc)[:160]}"
            if code in (429, 500, 502, 503, 504) or code is None:
                time.sleep(10 * (attempt + 1))
                continue
            break
    return None, err


def fake_result(specs: list[dict]) -> list[dict]:
    out = []
    for s in specs:
        if s["kind"] == "none":
            out.append({"text": "hello there", "notes": []})
            continue
        n = len(s["items"]) if s["kind"] in ("multi", "mixed") else 1
        amts = " + ".join(num(a) for a in amounts_of(s))
        out.append(
            {
                "text": f"[fake] {amts} {s['cur']}",
                "notes": [f"item{i}" for i in range(n)],
            }
        )
    return out


def collect(calls: int, fake: bool, pause: float) -> None:
    RAW.mkdir(exist_ok=True)
    client = types = None
    if not fake:
        from google import genai
        from google.genai import types as _types

        client, types = genai.Client(api_key=os.environ["GEMINI_API_KEY"]), _types
    for idx in range(calls):
        f = RAW / f"call_{idx:04d}.json"
        if f.exists():
            continue
        lang, specs = specs_for_call(idx)
        started = time.perf_counter()
        result, err = (
            (fake_result(specs), "")
            if fake
            else call_gemini(client, types, build_prompt(lang, specs))
        )
        status = "OK " if result and len(result) == len(specs) else "FAIL"
        print(
            f"call {idx + 1}/{calls} {lang} {time.perf_counter() - started:5.1f}s {status} {err}"
        )
        if status == "OK ":
            f.write_text(
                json.dumps(
                    {"lang": lang, "specs": specs, "result": result}, ensure_ascii=False
                )
            )
        if not fake:
            time.sleep(pause)


def v1_text(r: dict) -> str:
    return r["prompt"].split("\nExpense: ")[1].rsplit("\nJSON:", 1)[0].strip()


def v1_to_when(r: dict) -> dict:
    """Round-1 rows store a date; the model now writes a date code (0 or -N days) instead."""
    today = dt.date.fromisoformat(r["prompt"].split("Today: ")[1][:10])
    lab = json.loads(r["completion"])
    date = dt.date.fromisoformat(lab.pop("date"))
    lab["when"] = when_code_for(date, today)
    assert resolve_when(lab["when"], today) == date
    return {**r, "completion": make_completion(lab)}


def assemble(v1_rows: int) -> None:
    test = {
        json.loads(line)["text"].strip().lower()
        for line in (ML / "data/test.jsonl").open()
    }
    rows, seen, dropped = (
        [],
        set(),
        {"short_list": 0, "implausible": 0, "in_test": 0, "dup": 0, "length": 0},
    )
    for f in sorted(RAW.glob("call_*.json")):
        d = json.loads(f.read_text())
        for s, r in zip(d["specs"], d["result"], strict=True):
            text, notes = r["text"].strip(), [n.strip() or None for n in r["notes"]]
            need = len(s["items"]) if s["kind"] in ("multi", "mixed") else 0
            if len(notes) < need:
                dropped["short_list"] += 1
                continue
            if not text or len(text) > 160:
                dropped["length"] += 1
                continue
            if text.lower() in test:
                dropped["in_test"] += 1
                continue
            if not plausible(text, s):
                dropped["implausible"] += 1
                continue
            key = (text.lower(), s["today"])
            if key in seen:
                dropped["dup"] += 1
                continue
            seen.add(key)
            lab = label_for(s, notes[:need] if need else notes)
            rows.append(
                {
                    "lang": d["lang"],
                    "prompt": make_prompt(
                        text, dt.date.fromisoformat(s["today"]), s["default"]
                    ),
                    "completion": make_completion(lab),
                }
            )
    n_gemini = len(rows)
    v1 = [json.loads(line) for line in (ML / "data/train.jsonl").open()]
    random.Random(3).shuffle(v1)
    v1 = [r for r in v1 if v1_text(r).lower() not in test][:v1_rows]
    rows += [v1_to_when(r) for r in v1]
    random.Random(4).shuffle(rows)
    OUT.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )
    print(
        f"wrote {len(rows)} rows ({n_gemini} Gemini-worded + {len(rows) - n_gemini} round-1 template rows) to {OUT}"
    )
    print("dropped:", dropped)
    by = {}
    for r in rows:
        by[r["lang"]] = by.get(r["lang"], 0) + 1
    print("per language:", by)
    for r in random.Random(9).sample(
        rows[: n_gemini and len(rows)], min(10, len(rows))
    ):
        print(
            "  ",
            r["prompt"].split("\nExpense: ")[1].rsplit("\nJSON:", 1)[0],
            "->",
            r["completion"][:150],
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calls", type=int, default=180)
    ap.add_argument(
        "--pause", type=float, default=float(os.environ.get("PAUSE_SECONDS", "5"))
    )
    ap.add_argument(
        "--v1-rows", type=int, default=800, help="template rows from round 1 to mix in"
    )
    ap.add_argument("--assemble-only", action="store_true")
    ap.add_argument(
        "--fake",
        action="store_true",
        help="no API; placeholder wording, for testing the code",
    )
    a = ap.parse_args()
    global RAW, OUT
    if a.fake:  # never mix placeholder rows into the real files
        RAW, OUT = ML / "data" / "raw_v2_fake", ML / "data" / "train_v3_fake.jsonl"
    if not a.assemble_only:
        collect(a.calls, a.fake, a.pause)
    assemble(a.v1_rows)


if __name__ == "__main__":
    main()

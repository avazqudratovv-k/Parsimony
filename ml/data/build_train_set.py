"""Builds ml/data/train.jsonl: synthetic training data made from templates. No real data.

Run from the repo root:  python ml/data/build_train_set.py [--n 3000] [--seed 7]

Labels are correct by construction (the sentence is made FROM the label, never the other way
round). The test set is hand-written and separate: this script refuses to write a file if any
training sentence is identical to a test sentence, and uses its own reference dates, so the
model cannot simply memorise the test.
"""

import argparse
import datetime as dt
import json
import random
import sys
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from prompt import make_completion, make_prompt

# (en, ko, uz, category, low, high) in units of 100 KRW-style "small" amounts; scaled per currency
THINGS = [
    ("coffee", "커피", "kofe", "food_drink", 3, 8),
    ("lunch", "점심", "tushlik", "food_drink", 6, 20),
    ("dinner", "저녁", "kechki ovqat", "food_drink", 10, 60),
    ("bubble tea", "버블티", "choy", "food_drink", 4, 7),
    ("bus", "버스", "avtobus", "transport", 1, 3),
    ("taxi", "택시", "taksi", "transport", 5, 30),
    ("subway", "지하철", "metro", "transport", 1, 3),
    ("groceries", "장보기", "bozorlik", "groceries", 15, 90),
    ("vegetables", "채소", "sabzavot", "groceries", 5, 25),
    ("bread", "빵", "non", "groceries", 2, 10),
    ("t-shirt", "티셔츠", "futbolka", "shopping", 15, 60),
    ("shoes", "신발", "oyoqkiyim", "shopping", 40, 150),
    ("phone case", "폰케이스", "telefon g'ilofi", "shopping", 8, 30),
    ("electricity bill", "전기요금", "elektr to'lovi", "bills", 30, 120),
    ("internet bill", "인터넷 요금", "internet to'lovi", "bills", 25, 50),
    ("phone bill", "휴대폰 요금", "telefon to'lovi", "bills", 20, 80),
    ("pharmacy", "약국", "dorixona", "health", 3, 25),
    ("dentist", "치과", "tish shifokori", "health", 30, 200),
    ("movie", "영화", "kino", "entertainment", 10, 15),
    ("concert ticket", "콘서트 티켓", "konsert chiptasi", "entertainment", 50, 200),
    ("hotel", "호텔", "mehmonxona", "travel", 80, 400),
    ("train ticket", "기차표", "poyezd chiptasi", "travel", 40, 120),
    ("gift", "선물", "sovg'a", "other", 10, 80),
    ("donation", "기부", "xayriya", "other", 10, 50),
]
MERCHANTS = [  # merchants the model should copy as stated; invented-only or very common names
    ("Cafe Luna", "food_drink"),
    ("Blue Door Bakery", "groceries"),
    ("City Pharmacy", "health"),
    ("Metro Mart", "groceries"),
    ("Sunrise Hotel", "travel"),
    ("Pixel Cinema", "entertainment"),
    ("Green Fork", "food_drink"),
    ("Daily Fresh", "groceries"),
    ("Nova Mobile", "bills"),
    ("Urban Wear", "shopping"),
    ("Hanbit Kitchen", "food_drink"),
    ("Sam's Taxi", "transport"),
]
# each: key stored, en word, ko word, uz word
PAYMENTS = [
    ("card", "card", "카드", "karta"),
    ("cash", "cash", "현금", "naqd"),
    ("transfer", "bank transfer", "계좌이체", "o'tkazma"),
    ("mobile", "mobile pay", "삼성페이", "Click"),
    ("unknown", None, None, None),
]
# currency: code, en word, ko word, uz word, multiplier of the "small" unit, decimals
CURRENCIES = {
    "KRW": ("won", "원", "so'm", 1000, 0),
    "USD": ("dollars", "달러", "dollar", 1, 2),
    "EUR": ("euros", "유로", "yevro", 1, 2),
    "UZS": ("sum", "숨", "so'm", 10000, 0),
}
DAYS = {  # offset: en, ko, uz
    0: ("today", "오늘", "bugun"),
    1: ("yesterday", "어제", "kecha"),
    2: ("the day before yesterday", "그제", "2 kun oldin"),
}


def money(rng, low, high, cur):
    _, _, _, mult, dec = CURRENCIES[cur]
    base = rng.randint(low, high)
    if dec:
        return round(base + rng.choice([0, 0.5, 0.99, 0.25]), 2)
    return base * mult


def fmt(amount, cur, lang, rng):
    word = CURRENCIES[cur][{"en": 0, "ko": 1, "uz": 2}[lang]]
    if CURRENCIES[cur][4]:
        return rng.choice(
            [
                f"{amount:.2f} {word}",
                f"${amount:.2f}" if cur == "USD" else f"{amount:.2f} {cur}",
            ]
        )
    n = int(amount)
    if lang == "ko" and cur == "KRW" and n % 10000 == 0 and rng.random() < 0.6:
        return f"{n // 10000}만원"
    if lang == "uz" and n % 1000 == 0 and rng.random() < 0.6:
        return f"{n // 1000} ming {word}"
    return rng.choice(
        [
            f"{n:,} {word}",
            f"{n} {word}",
            f"{n:,}{word}" if lang == "ko" else f"{n:,} {word}",
        ]
    )


def one(rng, lang):
    today = dt.date(2026, 1, 1) + dt.timedelta(days=rng.randint(0, 330))
    default = rng.choice(["KRW", "KRW", "USD", "UZS", "EUR"])
    if rng.random() < 0.06:  # not an expense
        text = rng.choice(
            {
                "en": [
                    "hello there",
                    "what is the weather",
                    "remind me to call mom",
                    "thanks!",
                ],
                "ko": ["안녕하세요", "오늘 날씨 어때", "엄마한테 전화하기", "고마워요"],
                "uz": [
                    "salom",
                    "bugun ob-havo qanday",
                    "onamga qo'ng'iroq qilish",
                    "rahmat",
                ],
            }[lang]
        )
        label = {
            "date": today.isoformat(),
            "merchant": None,
            "note": None,
            "amount": 0,
            "currency": default,
            "category": "other",
            "payment_method": "unknown",
        }
        return lang, text, today, default, label
    en, ko, uz, cat, low, high = rng.choice(THINGS)
    thing = {"en": en, "ko": ko, "uz": uz}[lang]
    cur = default if rng.random() < 0.7 else rng.choice(list(CURRENCIES))
    amount = money(rng, low, high, cur)
    merchant = None
    if rng.random() < 0.25:
        merchant, cat = rng.choice(MERCHANTS)
        thing = None
    pay = rng.choice(PAYMENTS)
    offset = rng.choices([0, 1, 2, 3, 4, 5], [4, 4, 1, 1, 1, 1])[0]
    when_text = ""
    if offset <= 2 and rng.random() < 0.7:
        when_text = DAYS[offset][{"en": 0, "ko": 1, "uz": 2}[lang]]
    elif offset > 2:
        when_text = {
            "en": f"{offset} days ago",
            "ko": f"{offset}일 전",
            "uz": f"{offset} kun oldin",
        }[lang]
    date = today - dt.timedelta(days=offset if when_text else 0)
    price = fmt(amount, cur, lang, rng)
    paytxt = {"en": pay[1], "ko": pay[2], "uz": pay[3]}[lang]
    if lang == "ko" and paytxt and pay[0] == "card" and rng.random() < 0.4:
        paytxt = "카드로"
    subject = merchant if merchant else thing
    if merchant and rng.random() < 0.5:
        subject = {
            "en": f"{thing or 'purchase'} at {merchant}",
            "ko": f"{merchant}에서",
            "uz": merchant,
        }[lang]
    parts = [when_text, subject, price, paytxt]
    text = " ".join(p for p in parts if p)
    if lang == "en" and rng.random() < 0.3:
        text = text.capitalize()
    note = None if merchant else (thing.capitalize() if lang != "ko" else thing)
    label = {
        "date": date.isoformat(),
        "merchant": merchant,
        "note": note,
        "amount": amount,
        "currency": cur,
        "category": cat,
        "payment_method": pay[0],
    }
    return lang, text, today, default, label


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3000)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    test_texts = {
        json.loads(line)["text"].strip().lower()
        for line in (ML / "data/test.jsonl").open()
    }
    rows, seen = [], set()
    langs = ["en", "ko", "uz"]
    while len(rows) < args.n:
        lang, text, today, default, label = one(rng, langs[len(rows) % 3])
        key = (text.strip().lower(), today, default)
        if text.strip().lower() in test_texts or key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "lang": lang,
                "prompt": make_prompt(text, today, default),
                "completion": make_completion(label),
            }
        )
    out = ML / "data" / "train.jsonl"
    out.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(rows)} rows to {out} (no sentence shared with the test set)")


if __name__ == "__main__":
    main()

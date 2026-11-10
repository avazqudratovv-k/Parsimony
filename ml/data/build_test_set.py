"""Builds ml/data/test.jsonl: the hand-labeled test set (invented sentences, no real data).

Run it from the repo root:  python ml/data/build_test_set.py

Rules for this file:
- The test set is NEVER used for training. The training data is generated separately.
- Every case is judged as if "today" is 2026-11-09 (a Monday).
- Edit the labels here (not in the .jsonl), then run the script: it checks every case.
"""

import json
import sys
from datetime import date
from pathlib import Path

TODAY = date(2026, 11, 9)
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
PAYMENTS = {"card", "cash", "transfer", "mobile", "other", "unknown"}

D = {  # dates used below
    "today": "2026-11-09",
    "yesterday": "2026-11-08",
    "sat": "2026-11-07",
    "2ago": "2026-11-07",
    "fri": "2026-11-06",
    "3ago": "2026-11-06",
    "d3": "2026-11-03",
    "d5": "2026-11-05",
}


def case(
    lang,
    text,
    date_key,
    amount,
    cur,
    cat,
    pay,
    merchant=None,
    default="KRW",
    items=None,
    note=None,
):
    """One labeled case. merchant is a list of accepted spellings, or None for 'no merchant stated'."""
    return {
        "lang": lang,
        "text": text,
        "default_currency": default,
        "reference_date": "2026-11-09",
        "expected": {
            "not_expense": False,
            "date": D[date_key],
            "amount": amount,
            "currency": cur,
            "category": cat,
            "payment_method": pay,
            "merchant": merchant,
            "items": items or [],
        },
        "note": note,
    }


def nope(lang, text):
    return {
        "lang": lang,
        "text": text,
        "default_currency": "KRW",
        "reference_date": "2026-11-09",
        "expected": {"not_expense": True},
        "note": "not an expense: amount must be 0",
    }


def mixed(lang, text, items, note="mixed currencies: only the items are judged"):
    c = case(lang, text, "today", None, None, None, None, items=items, note=note)
    c["expected"].update(
        {"amount": None, "currency": None, "category": None, "payment_method": None}
    )
    return c


def I(amount, cat, cur=None, pay=None):
    return {"amount": amount, "category": cat, "currency": cur, "payment_method": pay}


CASES = [
    # ---------------- English ----------------
    case(
        "en",
        "Coffee with Sam, $6.50, card, this morning",
        "today",
        6.5,
        "USD",
        "food_drink",
        "card",
        default="USD",
    ),
    case(
        "en",
        "yesterday taxi 12,000 won cash",
        "yesterday",
        12000,
        "KRW",
        "transport",
        "cash",
    ),
    case(
        "en",
        "lunch at Kimbap Cheonguk 8500 won card",
        "today",
        8500,
        "KRW",
        "food_drink",
        "card",
        ["Kimbap Cheonguk"],
    ),
    case(
        "en",
        "Netflix 15.49 EUR",
        "today",
        15.49,
        "EUR",
        "entertainment",
        "unknown",
        ["Netflix"],
    ),
    case(
        "en",
        "bought milk 2,000 won and shampoo 5,500 won at GS25 by card",
        "today",
        7500,
        "KRW",
        "shopping",
        "card",
        ["GS25"],
        items=[I(2000, "groceries"), I(5500, "shopping")],
    ),
    case(
        "en",
        "Metro card top-up €20 cash yesterday",
        "yesterday",
        20,
        "EUR",
        "transport",
        "cash",
    ),
    case(
        "en", "rent 650,000 won transfer", "today", 650000, "KRW", "bills", "transfer"
    ),
    case(
        "en",
        "paid electricity bill 48,300 won",
        "today",
        48300,
        "KRW",
        "bills",
        "unknown",
    ),
    case(
        "en",
        "pharmacy, cold medicine, 7,000 won, cash, two days ago",
        "2ago",
        7000,
        "KRW",
        "health",
        "cash",
    ),
    case(
        "en",
        "cinema tickets 28000 won on Saturday, card",
        "sat",
        28000,
        "KRW",
        "entertainment",
        "card",
    ),
    case(
        "en",
        "Uber to the airport $38 card last Friday",
        "fri",
        38,
        "USD",
        "transport",
        "card",
        ["Uber"],
        default="USD",
    ),
    case(
        "en",
        "groceries at Emart 54,200 KRW card",
        "today",
        54200,
        "KRW",
        "groceries",
        "card",
        ["Emart"],
    ),
    case(
        "en",
        "new running shoes 129,000 won Kakao Pay",
        "today",
        129000,
        "KRW",
        "shopping",
        "mobile",
    ),
    case(
        "en",
        "hotel in Busan 2 nights 240,000 won card",
        "today",
        240000,
        "KRW",
        "travel",
        "card",
    ),
    case("en", "bus 1,500", "today", 1500, "KRW", "transport", "unknown"),
    case(
        "en",
        "snack 3 dollars",
        "today",
        3,
        "USD",
        "food_drink",
        "unknown",
        default="USD",
    ),
    case(
        "en",
        "bought a book for 14.99 GBP online, card",
        "today",
        14.99,
        "GBP",
        "shopping",
        "card",
    ),
    case("en", "haircut 20,000 won", "today", 20000, "KRW", "other", "unknown"),
    case(
        "en",
        "dinner with the team 87,000 won, I paid on card",
        "today",
        87000,
        "KRW",
        "food_drink",
        "card",
    ),
    case(
        "en", "weekly train ticket 45 euros", "today", 45, "EUR", "transport", "unknown"
    ),
    case(
        "en",
        "Apple Music 10.99 USD",
        "today",
        10.99,
        "USD",
        "entertainment",
        "unknown",
        ["Apple Music"],
    ),
    case(
        "en",
        "gift for mom 60,000 won, cash, on the 3rd",
        "d3",
        60000,
        "KRW",
        "shopping",
        "cash",
    ),
    case(
        "en",
        "bag 15,000 won card, wallet 30,000 won cash",
        "today",
        45000,
        "KRW",
        "shopping",
        "cash",
        items=[I(15000, "shopping", None, "card"), I(30000, "shopping", None, "cash")],
    ),
    mixed(
        "en",
        "laptop 50$ cash, macbook 150000 krw card",
        [I(50, "shopping", "USD", "cash"), I(150000, "shopping", "KRW", "card")],
    ),
    nope("en", "remind me to call the dentist tomorrow"),
    nope("en", "hello"),
    case(
        "en",
        "cofee 4500 won crd",
        "today",
        4500,
        "KRW",
        "food_drink",
        "card",
        note="typos",
    ),
    case(
        "en",
        "paid 120 USD for an online course, card",
        "today",
        120,
        "USD",
        "other",
        "card",
    ),
    case("en", "gas 54,000 won", "today", 54000, "KRW", "transport", "unknown"),
    case(
        "en",
        "bubble tea 4,500 won, mobile pay, this afternoon",
        "today",
        4500,
        "KRW",
        "food_drink",
        "mobile",
    ),
    case("en", "doctor visit 15,000 won", "today", 15000, "KRW", "health", "unknown"),
    case(
        "en",
        "wifi bill 33,000 won, transfer, on the 5th",
        "d5",
        33000,
        "KRW",
        "bills",
        "transfer",
    ),
    case(
        "en",
        "flight to Tokyo 210,000 won card",
        "today",
        210000,
        "KRW",
        "travel",
        "card",
    ),
    case(
        "en",
        "dinner 3 days ago 42,000 won cash",
        "3ago",
        42000,
        "KRW",
        "food_drink",
        "cash",
    ),
    # ---------------- Korean ----------------
    case(
        "ko",
        "스타벅스 아메리카노 4,500원 카드",
        "today",
        4500,
        "KRW",
        "food_drink",
        "card",
        ["Starbucks", "스타벅스"],
    ),
    case(
        "ko", "어제 택시 12,000원 현금", "yesterday", 12000, "KRW", "transport", "cash"
    ),
    case(
        "ko", "점심 김치찌개 9000원 카드로", "today", 9000, "KRW", "food_drink", "card"
    ),
    case(
        "ko",
        "GS25에서 우유 2,000원 샴푸 5,500원 카드",
        "today",
        7500,
        "KRW",
        "shopping",
        "card",
        ["GS25"],
        items=[I(2000, "groceries"), I(5500, "shopping")],
    ),
    case("ko", "월세 65만원 계좌이체", "today", 650000, "KRW", "bills", "transfer"),
    case("ko", "전기요금 4만8천3백원", "today", 48300, "KRW", "bills", "unknown"),
    case("ko", "약국 감기약 7천원 현금 그저께", "2ago", 7000, "KRW", "health", "cash"),
    case(
        "ko",
        "토요일에 영화 2만8천원 카드",
        "sat",
        28000,
        "KRW",
        "entertainment",
        "card",
    ),
    case(
        "ko",
        "이마트 장보기 54,200원 카드",
        "today",
        54200,
        "KRW",
        "groceries",
        "card",
        ["Emart", "이마트"],
    ),
    case(
        "ko",
        "카카오페이로 운동화 12만9천원",
        "today",
        129000,
        "KRW",
        "shopping",
        "mobile",
    ),
    case("ko", "부산 호텔 2박 24만원 카드", "today", 240000, "KRW", "travel", "card"),
    case("ko", "버스 1500원", "today", 1500, "KRW", "transport", "unknown"),
    case(
        "ko",
        "이번 주 지하철 정기권 45,000원",
        "today",
        45000,
        "KRW",
        "transport",
        "unknown",
    ),
    case("ko", "미용실 컷 2만원 현금", "today", 20000, "KRW", "other", "cash"),
    case(
        "ko",
        "팀 회식 87,000원 내 카드로 결제",
        "today",
        87000,
        "KRW",
        "food_drink",
        "card",
    ),
    case(
        "ko",
        "넷플릭스 17,000원",
        "today",
        17000,
        "KRW",
        "entertainment",
        "unknown",
        ["Netflix", "넷플릭스"],
    ),
    case("ko", "엄마 선물 6만원 현금 3일에", "d3", 60000, "KRW", "shopping", "cash"),
    case(
        "ko",
        "편의점 삼각김밥 1,300원 바나나우유 1,800원",
        "today",
        3100,
        "KRW",
        "food_drink",
        "unknown",
    ),
    case("ko", "치킨 22,000원 배달 현금", "today", 22000, "KRW", "food_drink", "cash"),
    case("ko", "책 구매 1만4천원 카드", "today", 14000, "KRW", "shopping", "card"),
    case("ko", "주유 5만원", "today", 50000, "KRW", "transport", "unknown"),
    case("ko", "병원 진료비 15,000원", "today", 15000, "KRW", "health", "unknown"),
    case(
        "ko",
        "인터넷 요금 33,000원 5일에 자동이체",
        "d5",
        33000,
        "KRW",
        "bills",
        "transfer",
    ),
    case("ko", "도쿄 항공권 21만원 카드", "today", 210000, "KRW", "travel", "card"),
    case(
        "ko", "커피 4500원 오늘 아침 현금", "today", 4500, "KRW", "food_drink", "cash"
    ),
    case(
        "ko",
        "가방 15,000원 카드 지갑 30,000원 현금",
        "today",
        45000,
        "KRW",
        "shopping",
        "cash",
        items=[I(15000, "shopping", None, "card"), I(30000, "shopping", None, "cash")],
    ),
    mixed(
        "ko",
        "노트북 50달러 현금 맥북 15만원 카드",
        [I(50, "shopping", "USD", "cash"), I(150000, "shopping", "KRW", "card")],
    ),
    nope("ko", "내일 치과 예약해야 해"),
    nope("ko", "안녕"),
    case("ko", "택시 만이천원", "today", 12000, "KRW", "transport", "unknown"),
    case("ko", "어제 점심 8천원", "yesterday", 8000, "KRW", "food_drink", "unknown"),
    case(
        "ko",
        "스팀 게임 25,000원 카드",
        "today",
        25000,
        "KRW",
        "entertainment",
        "card",
        ["Steam", "스팀"],
    ),
    case("ko", "헬스장 3개월 25만원 카드", "today", 250000, "KRW", "health", "card"),
    # ---------------- Uzbek ----------------
    case(
        "uz",
        "Taksi 25 ming so'm naqd kecha",
        "yesterday",
        25000,
        "UZS",
        "transport",
        "cash",
        default="UZS",
    ),
    case(
        "uz",
        "Tushlik osh 35 000 so'm karta bilan",
        "today",
        35000,
        "UZS",
        "food_drink",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "Korzinkada non va sut 18 ming so'm",
        "today",
        18000,
        "UZS",
        "groceries",
        "unknown",
        ["Korzinka"],
        default="UZS",
    ),
    case(
        "uz",
        "Kofe 4500 won karta",
        "today",
        4500,
        "KRW",
        "food_drink",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "Ijara 3 million so'm o'tkazma",
        "today",
        3000000,
        "UZS",
        "bills",
        "transfer",
        default="UZS",
    ),
    case(
        "uz",
        "Elektr to'lovi 85 ming so'm",
        "today",
        85000,
        "UZS",
        "bills",
        "unknown",
        default="UZS",
    ),
    case(
        "uz",
        "Dorixonada shamollash dorisi 40 ming so'm naqd, ikki kun oldin",
        "2ago",
        40000,
        "UZS",
        "health",
        "cash",
        default="UZS",
    ),
    case(
        "uz",
        "Shanba kuni kino 60 ming so'm karta",
        "sat",
        60000,
        "UZS",
        "entertainment",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "Makromarketda 230 000 so'm karta",
        "today",
        230000,
        "UZS",
        "groceries",
        "card",
        ["Makro", "Makromarket"],
        default="UZS",
    ),
    case(
        "uz",
        "krossovka 450 ming so'm Click orqali",
        "today",
        450000,
        "UZS",
        "shopping",
        "mobile",
        default="UZS",
    ),
    case(
        "uz",
        "Samarqandda mehmonxona 2 kecha 600 ming so'm karta",
        "today",
        600000,
        "UZS",
        "travel",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "avtobus 1400 so'm",
        "today",
        1400,
        "UZS",
        "transport",
        "unknown",
        default="UZS",
    ),
    case(
        "uz",
        "Netflix 15.49 dollar",
        "today",
        15.49,
        "USD",
        "entertainment",
        "unknown",
        ["Netflix"],
        default="UZS",
    ),
    case(
        "uz",
        "sartaroshxona 50 ming so'm naqd",
        "today",
        50000,
        "UZS",
        "other",
        "cash",
        default="UZS",
    ),
    case(
        "uz",
        "Onam uchun sovg'a 300 ming so'm naqd 3-kuni",
        "d3",
        300000,
        "UZS",
        "shopping",
        "cash",
        default="UZS",
    ),
    case(
        "uz",
        "Toshkentga samolyot chiptasi 900 ming so'm karta",
        "today",
        900000,
        "UZS",
        "travel",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "benzin 200 ming so'm",
        "today",
        200000,
        "UZS",
        "transport",
        "unknown",
        default="UZS",
    ),
    case(
        "uz",
        "shifokor ko'rigi 100 ming so'm",
        "today",
        100000,
        "UZS",
        "health",
        "unknown",
        default="UZS",
    ),
    case(
        "uz",
        "internet 90 ming so'm 5-kuni o'tkazma",
        "d5",
        90000,
        "UZS",
        "bills",
        "transfer",
        default="UZS",
    ),
    case(
        "uz",
        "kitob 80 ming so'm karta",
        "today",
        80000,
        "UZS",
        "shopping",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "Bugun ertalab choy 5 ming so'm naqd",
        "today",
        5000,
        "UZS",
        "food_drink",
        "cash",
        default="UZS",
    ),
    case(
        "uz",
        "sumka 150 ming karta, hamyon 300 ming naqd",
        "today",
        450000,
        "UZS",
        "shopping",
        "cash",
        default="UZS",
        items=[
            I(150000, "shopping", None, "card"),
            I(300000, "shopping", None, "cash"),
        ],
    ),
    mixed(
        "uz",
        "noutbuk 50$ naqd, makbuk 150000 won karta",
        [I(50, "shopping", "USD", "cash"), I(150000, "shopping", "KRW", "card")],
    ),
    nope("uz", "ertaga stomatologga yozilishim kerak"),
    nope("uz", "salom"),
    case(
        "uz",
        "GS25da suv 1200 won karta",
        "today",
        1200,
        "KRW",
        "groceries",
        "card",
        ["GS25"],
        default="UZS",
    ),
    case(
        "uz",
        "kecha tushlik 9000 won",
        "yesterday",
        9000,
        "KRW",
        "food_drink",
        "unknown",
        default="UZS",
    ),
    case(
        "uz",
        "Spotify 12 dollar",
        "today",
        12,
        "USD",
        "entertainment",
        "unknown",
        ["Spotify"],
        default="UZS",
    ),
    case(
        "uz",
        "taksi 12 000 won naqd",
        "today",
        12000,
        "KRW",
        "transport",
        "cash",
        default="UZS",
    ),
    case(
        "uz",
        "onlayn kurs 100 dollar karta",
        "today",
        100,
        "USD",
        "other",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "sport zal 3 oy 250 ming won karta",
        "today",
        250000,
        "KRW",
        "health",
        "card",
        default="UZS",
    ),
    case(
        "uz",
        "non 3 ming so'm",
        "today",
        3000,
        "UZS",
        "groceries",
        "unknown",
        default="UZS",
    ),
    case(
        "uz",
        "kafe 70 ming so'm, uch kun oldin",
        "3ago",
        70000,
        "UZS",
        "food_drink",
        "unknown",
        default="UZS",
    ),
]


def check(rows):
    problems = []
    seen = set()
    for n, r in enumerate(rows, 1):
        tag = f"#{n} {r['text']!r}"
        if r["text"] in seen:
            problems.append(f"{tag}: duplicate text")
        seen.add(r["text"])
        e = r["expected"]
        if e.get("not_expense"):
            continue
        if e["category"] is not None and e["category"] not in CATEGORIES:
            problems.append(f"{tag}: bad category")
        if e["payment_method"] is not None and e["payment_method"] not in PAYMENTS:
            problems.append(f"{tag}: bad payment method")
        if date.fromisoformat(e["date"]) > TODAY:
            problems.append(f"{tag}: date in the future")
        for it in e["items"]:
            if it["category"] not in CATEGORIES:
                problems.append(f"{tag}: bad item category")
        single = e["items"] and all(it["currency"] is None for it in e["items"])
        if single and sum(it["amount"] for it in e["items"]) != e["amount"]:
            problems.append(f"{tag}: items do not add up to the amount")
    return problems


if __name__ == "__main__":
    problems = check(CASES)
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    out = Path(__file__).with_name("test.jsonl")
    out.write_text(
        "".join(json.dumps(c, ensure_ascii=False) + "\n" for c in CASES),
        encoding="utf-8",
    )
    by_lang = {
        lang: sum(c["lang"] == lang for c in CASES) for lang in ("en", "ko", "uz")
    }
    print(f"{len(CASES)} cases written to {out} {by_lang}")

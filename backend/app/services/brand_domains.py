"""Well-known brands and the website whose icon is their logo.

The model only guesses a domain. For brands we know, this list wins, because a wrong guess (or a
site with no usable icon) just shows the category icon. Names are matched after lowercasing and
dropping spaces and punctuation. Add a brand only after checking its icon loads.
"""

import re

_BRANDS = {
    "starbucks": "starbucks.co.kr",
    "스타벅스": "starbucks.co.kr",
    "netflix": "netflix.com",
    "넷플릭스": "netflix.com",
    "spotify": "spotify.com",
    "chipotle": "chipotle.com",
    "wholefoods": "wholefoodsmarket.com",
    "traderjoes": "traderjoes.com",
    "shell": "shell.com",
    "coupang": "coupang.com",
    "쿠팡": "coupang.com",
    "baemin": "baemin.com",
    "배달의민족": "baemin.com",
    "oliveyoung": "oliveyoung.co.kr",
    "올리브영": "oliveyoung.co.kr",
}


def _key(name: str) -> str:
    return re.sub(r"[\W_]+", "", name.lower())


def known_domain(merchant: str | None) -> str | None:
    """The logo domain for a known brand, else None."""
    return _BRANDS.get(_key(merchant)) if merchant else None

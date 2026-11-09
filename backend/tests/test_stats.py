from tests.helpers import add_manual, signup


def test_monthly_stats_group_by_category_in_one_currency(client):
    signup(client)
    add_manual(client, date="2026-10-02", amount=10, category="food_drink")
    add_manual(client, date="2026-10-09", amount=5.25, category="food_drink")
    add_manual(client, date="2026-10-15", amount=40, category="transport")
    add_manual(client, date="2026-10-20", amount=100, currency="EUR", category="travel")
    add_manual(client, date="2026-11-01", amount=999, category="shopping")  # other month

    stats = client.get("/api/stats/monthly", params={"month": "2026-10"}).json()

    assert stats["currency"] == "USD"  # the user's default currency
    assert stats["total"] == "55.25"
    assert stats["count"] == 3
    assert stats["by_category"] == [
        {"category": "transport", "total": "40.00", "count": 1},
        {"category": "food_drink", "total": "15.25", "count": 2},
    ]
    assert [(c["currency"], c["total"], c["count"]) for c in stats["currencies"]] == [
        ("EUR", "100.00", 1),  # biggest total first
        ("USD", "55.25", 3),
    ]
    assert stats["active_days"] == 4  # four different days, any currency


def test_choosing_another_currency(client):
    signup(client)
    add_manual(client, date="2026-10-02", amount=10)
    add_manual(client, date="2026-10-03", amount=100, currency="EUR", category="travel")

    eur = client.get("/api/stats/monthly", params={"month": "2026-10", "currency": "eur"}).json()
    assert eur["currency"] == "EUR" and eur["total"] == "100.00"
    assert [c["category"] for c in eur["by_category"]] == ["travel"]


def test_default_falls_back_to_the_biggest_currency(client):
    signup(client)  # default currency is USD, but no USD entries this month
    add_manual(client, date="2026-10-03", amount=5, currency="KRW")
    add_manual(client, date="2026-10-04", amount=30000, currency="KRW")
    add_manual(client, date="2026-10-04", amount=7, currency="EUR")

    stats = client.get("/api/stats/monthly", params={"month": "2026-10"}).json()
    assert stats["currency"] == "KRW" and stats["count"] == 2


def test_empty_month_returns_zeros(client):
    signup(client)
    stats = client.get("/api/stats/monthly", params={"month": "2026-10"}).json()
    assert stats == {
        "month": "2026-10",
        "currency": "USD",
        "total": "0.00",
        "count": 0,
        "by_category": [],
        "currencies": [],
        "active_days": 0,
    }


def test_month_defaults_to_the_current_month(client):
    signup(client)
    stats = client.get("/api/stats/monthly").json()
    assert len(stats["month"]) == 7 and stats["month"][4] == "-"


def test_stats_only_count_own_entries_and_need_login(client):
    signup(client, "a@example.com")
    add_manual(client, date="2026-10-02", amount=10)
    client.post("/api/auth/logout")
    assert client.get("/api/stats/monthly").status_code == 401

    signup(client, "b@example.com")
    stats = client.get("/api/stats/monthly", params={"month": "2026-10"}).json()
    assert stats["count"] == 0
    assert client.get("/api/stats/monthly", params={"month": "bad"}).status_code == 422

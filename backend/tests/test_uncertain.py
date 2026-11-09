from tests.fakes import FakeParser, good_json
from tests.helpers import signup, use_parser


def add(client, **overrides):
    use_parser(FakeParser(good_json(**overrides)))
    return client.post("/api/entries", json={"text": "coffee"})


def test_the_fields_the_model_guessed_are_returned_with_the_entry(client):
    signup(client)
    body = add(client, confidence=0.4, uncertain=["amount", "date"]).json()
    assert body["uncertain"] == ["amount", "date"]
    assert client.get("/api/entries").json()[0]["uncertain"] == ["amount", "date"]


def test_unknown_names_and_duplicates_are_dropped_and_nothing_fails(client):
    signup(client)
    body = add(client, uncertain=["date", "date", "price", 7]).json()
    assert body["uncertain"] == ["date"]


def test_a_missing_or_malformed_list_means_nothing_to_point_at(client):
    signup(client)
    assert add(client).json()["uncertain"] == []
    assert add(client, uncertain="amount").json()["uncertain"] == []


def test_confirming_clears_the_flag_without_calling_it_an_edit(client):
    signup(client)
    entry = add(client, confidence=0.4, uncertain=["amount"]).json()
    assert entry["confirmed"] is False

    done = client.patch(f"/api/entries/{entry['id']}", json={"confirmed": True}).json()
    assert done["confirmed"] is True
    assert done["user_corrected"] is False  # nothing was changed, so it is not "edited"
    assert done["amount"] == entry["amount"]


def test_checking_one_item_checks_the_whole_purchase(client):
    signup(client)
    items = [
        {"note": "Milk", "amount": 2000, "category": "groceries"},
        {"note": "Shampoo", "amount": 5500, "category": "shopping"},
    ]
    use_parser(
        FakeParser(
            good_json(
                merchant="GS25",
                amount=7500,
                currency="KRW",
                items=items,
                confidence=0.4,
            )
        )
    )
    first = client.post("/api/entries", json={"text": "gs25"}).json()
    client.patch(f"/api/entries/{first['id']}", json={"confirmed": True})
    assert all(e["confirmed"] for e in client.get("/api/entries").json())


def test_a_real_edit_also_counts_as_checked(client):
    signup(client)
    entry = add(client, confidence=0.4).json()
    done = client.patch(f"/api/entries/{entry['id']}", json={"amount": "7.00"}).json()
    assert done["confirmed"] is True and done["user_corrected"] is True

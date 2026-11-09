from tests.fakes import FakeParser, good_json
from tests.helpers import signup, use_parser

ITEMS = [
    {"note": "Milk", "amount": 2000, "category": "groceries"},
    {"note": "Shampoo", "amount": 5500, "category": "shopping"},
]


def post(client, text="GS25 milk 2000 shampoo 5500 won card"):
    return client.post("/api/entries", json={"text": text})


def answer(**overrides):
    base = {
        "date": "2026-10-15",
        "merchant": "GS25",
        "note": None,
        "amount": 7500,
        "currency": "KRW",
        "category": "shopping",
        "payment_method": "card",
        "items": ITEMS,
    }
    base.update(overrides)
    return good_json(**base)


def test_a_purchase_with_several_items_becomes_one_entry_per_item(client):
    signup(client)
    use_parser(FakeParser(answer()))
    response = post(client)

    assert response.status_code == 201
    body = response.json()
    assert [body["note"], body["siblings"][0]["note"]] == ["Milk", "Shampoo"]
    assert [body["category"], body["siblings"][0]["category"]] == ["groceries", "shopping"]
    listed = client.get("/api/entries").json()
    assert sorted(e["amount"] for e in listed) == ["2000.00", "5500.00"]
    assert {e["merchant"] for e in listed} == {"GS25"}
    assert {e["raw_input"] for e in listed} == {"GS25 milk 2000 shampoo 5500 won card"}


def test_the_items_of_one_purchase_share_a_group_id_and_a_normal_entry_has_none(client):
    signup(client)
    use_parser(FakeParser(answer()))
    body = post(client).json()
    assert body["group_id"] is not None
    assert body["siblings"][0]["group_id"] == body["group_id"]

    use_parser(FakeParser(good_json(date="2026-10-15")))
    assert post(client, "coffee").json()["group_id"] is None


def test_it_costs_one_ai_call_not_one_per_item(client):
    signup(client)
    parser = FakeParser(answer())
    use_parser(parser)
    post(client)
    assert len(parser.calls) == 1


def test_items_that_do_not_add_up_are_ignored_and_the_total_is_saved(client):
    signup(client)
    use_parser(FakeParser(answer(amount=9000)))
    body = post(client).json()
    assert body["siblings"] == []
    assert body["amount"] == "9000.00"
    assert len(client.get("/api/entries").json()) == 1


def test_a_single_item_is_not_split(client):
    signup(client)
    use_parser(FakeParser(answer(amount=2000, items=[ITEMS[0]])))
    body = post(client).json()
    assert body["siblings"] == []
    assert body["amount"] == "2000.00"


def test_a_normal_entry_still_has_no_siblings(client):
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))
    assert post(client, "coffee").json()["siblings"] == []


def test_no_amount_says_so_with_a_code_the_app_can_translate(client):
    signup(client)
    use_parser(FakeParser(good_json(amount=0)))
    response = post(client, "1 dish and 1 fork at Dyson")
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "no_amount"

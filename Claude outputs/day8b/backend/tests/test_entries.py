import pytest

from tests.fakes import FakeParser, good_json
from tests.helpers import add_manual, manual_payload, signup, use_parser


def create_from_text(client, text="Coffee with Sam, $6.50, card"):
    return client.post("/api/entries", json={"text": text})


def test_create_from_text_saves_an_entry(client):
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))
    response = create_from_text(client)

    assert response.status_code == 201
    entry = response.json()
    assert entry["amount"] == "6.50"
    assert entry["source"] == "text"
    assert entry["raw_input"] == "Coffee with Sam, $6.50, card"
    assert entry["model_used"] == "fake-model"
    assert entry["confidence"] == 0.85
    assert entry["user_corrected"] is False

    listed = client.get("/api/entries").json()
    assert [e["id"] for e in listed] == [entry["id"]]


def test_failed_parse_saves_nothing(client):
    signup(client)
    use_parser(FakeParser("garbage"))
    assert create_from_text(client).status_code == 422
    assert client.get("/api/entries").json() == []


def test_list_is_newest_first_and_filterable(client):
    signup(client)
    add_manual(client, date="2026-10-01", note="old")
    add_manual(client, date="2026-10-20", note="new")
    add_manual(client, date="2026-11-02", note="november")
    add_manual(client, date="2026-10-10", currency="EUR", note="euro")

    october = client.get("/api/entries", params={"month": "2026-10"}).json()
    assert [e["note"] for e in october] == ["new", "euro", "old"]

    october_usd = client.get("/api/entries", params={"month": "2026-10", "currency": "usd"}).json()
    assert [e["note"] for e in october_usd] == ["new", "old"]

    assert len(client.get("/api/entries", params={"limit": 2}).json()) == 2
    assert client.get("/api/entries", params={"month": "2026-13"}).status_code == 422


def test_entries_are_private_to_their_owner(client):
    signup(client, "a@example.com")
    entry = add_manual(client)
    client.post("/api/auth/logout")

    signup(client, "b@example.com")
    assert client.get("/api/entries").json() == []
    assert client.get(f"/api/entries/{entry['id']}").status_code == 404
    assert client.patch(f"/api/entries/{entry['id']}", json={"note": "hax"}).status_code == 404
    assert client.delete(f"/api/entries/{entry['id']}").status_code == 404


def test_requires_login(client):
    assert client.get("/api/entries").status_code == 401
    assert client.post("/api/entries/manual", json=manual_payload()).status_code == 401


def test_fix_this_updates_fields_and_marks_ai_entries_corrected(client):
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))
    entry = create_from_text(client).json()

    response = client.patch(
        f"/api/entries/{entry['id']}",
        json={"amount": 7.005, "category": "groceries", "merchant": "  Trader Joe's "},
    )
    assert response.status_code == 200
    fixed = response.json()
    assert fixed["amount"] == "7.01"
    assert fixed["category"] == "groceries"
    assert fixed["merchant"] == "Trader Joe's"
    assert fixed["note"] == "Coffee with Sam"  # untouched fields stay
    assert fixed["user_corrected"] is True
    assert fixed["raw_input"] == "Coffee with Sam, $6.50, card"


def test_patch_that_changes_nothing_is_not_a_correction(client):
    signup(client)
    use_parser(FakeParser(good_json(date="2026-10-15")))
    entry = create_from_text(client).json()

    same = client.patch(f"/api/entries/{entry['id']}", json={"category": "food_drink"}).json()
    assert same["user_corrected"] is False


def test_patch_can_clear_merchant_but_not_required_fields(client):
    signup(client)
    entry = add_manual(client, merchant="Shop")

    cleared = client.patch(f"/api/entries/{entry['id']}", json={"merchant": None})
    assert cleared.status_code == 200 and cleared.json()["merchant"] is None

    for bad in ({"amount": None}, {"date": None}, {"category": "snacks"}, {"amount": -1}):
        assert client.patch(f"/api/entries/{entry['id']}", json=bad).status_code == 422


def test_manual_entries_are_not_marked_corrected(client):
    signup(client)
    entry = add_manual(client)
    assert entry["model_used"] == "manual" and entry["confidence"] == 1.0

    fixed = client.patch(f"/api/entries/{entry['id']}", json={"amount": 9}).json()
    assert fixed["amount"] == "9.00"
    assert fixed["user_corrected"] is False


@pytest.mark.parametrize(
    "bad", [{"amount": 0}, {"currency": "dollars"}, {"category": "x"}, {"date": "soon"}]
)
def test_manual_entry_validation(client, bad):
    signup(client)
    response = client.post("/api/entries/manual", json=manual_payload(**bad))
    assert response.status_code == 422


def test_delete_entry(client):
    signup(client)
    entry = add_manual(client)
    assert client.delete(f"/api/entries/{entry['id']}").status_code == 204
    assert client.get(f"/api/entries/{entry['id']}").status_code == 404
    assert client.get("/api/entries/not-a-uuid").status_code == 422

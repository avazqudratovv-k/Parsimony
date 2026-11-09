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

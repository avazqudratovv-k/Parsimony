from app.ai.registry import get_image_parser, get_text_parser
from app.main import app


def signup(client, email="me@example.com", password="correct horse battery"):
    response = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 201
    return response.json()


def use_parser(parser):
    app.dependency_overrides[get_text_parser] = lambda: parser


def use_image_parser(parser):
    app.dependency_overrides[get_image_parser] = lambda: parser


def manual_payload(**overrides):
    data = {
        "date": "2026-10-15",
        "merchant": "Blue Bottle",
        "note": None,
        "amount": 6.5,
        "currency": "USD",
        "category": "food_drink",
        "payment_method": "card",
    }
    data.update(overrides)
    return data


def add_manual(client, **overrides):
    response = client.post("/api/entries/manual", json=manual_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def db_session():
    """A session on the same in-memory database the test client uses."""
    from app.db import get_db

    return next(app.dependency_overrides[get_db]())


def start_demo(client, **body):
    response = client.post("/api/auth/demo", json=body or None)
    assert response.status_code == 201, response.text
    return response.json()

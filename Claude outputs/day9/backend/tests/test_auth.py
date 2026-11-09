CREDS = {"email": "Avaz@Example.com", "password": "correct horse battery"}


def signup(client, **overrides):
    return client.post("/api/auth/signup", json={**CREDS, **overrides})


def test_signup_sets_cookie_and_me_works(client):
    response = signup(client)
    assert response.status_code == 201
    assert response.json()["email"] == "avaz@example.com"  # stored lowercase
    assert "password" not in response.text
    assert "httponly" in response.headers["set-cookie"].lower()

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "avaz@example.com"
    assert me.json()["is_demo"] is False


def test_duplicate_email_is_rejected_case_insensitively(client):
    assert signup(client).status_code == 201
    assert signup(client, email="AVAZ@example.com").status_code == 409


def test_short_password_is_rejected(client):
    assert signup(client, password="short").status_code == 422


def test_login_with_right_and_wrong_password(client):
    signup(client)
    client.cookies.clear()

    assert (
        client.post("/api/auth/login", json={**CREDS, "password": "nope-nope"}).status_code == 401
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "who@example.com", "password": "x"}
        ).status_code
        == 401
    )

    ok = client.post("/api/auth/login", json=CREDS)
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_me_requires_login(client):
    assert client.get("/api/auth/me").status_code == 401


def test_tampered_cookie_is_rejected(client):
    client.cookies.set("parsimony_session", "not-a-real-token")
    assert client.get("/api/auth/me").status_code == 401


def test_logout_clears_session(client):
    signup(client)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_login_is_rate_limited(client):
    for _ in range(10):
        client.post("/api/auth/login", json={"email": "a@example.com", "password": "x"})
    blocked = client.post("/api/auth/login", json={"email": "a@example.com", "password": "x"})
    assert blocked.status_code == 429
    assert "retry-after" in blocked.headers


def test_signup_is_rate_limited(client):
    for i in range(5):
        assert signup(client, email=f"user{i}@example.com").status_code == 201
    assert signup(client, email="user99@example.com").status_code == 429


def test_rate_limit_scale_raises_the_limit(client, monkeypatch):
    # Only the browser tests turn this up; with scale 2 the sixth sign-up still works.
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "rate_limit_scale", 2)
    for i in range(6):
        assert signup(client, email=f"scaled{i}@example.com").status_code == 201

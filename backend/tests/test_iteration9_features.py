"""Iteration 9 backend tests:
1) PUT /api/users/me/username — validate 200, 400, 409, 429 flows
2) GET /api/auth/me returns username; backfilled for all seeded users
3) user_card / user_public expose username on partners and conversation partner
"""
import os
import uuid

import requests


def _from_env_file():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return ""


BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or _from_env_file()
).rstrip("/")
API = f"{BASE_URL}/api"

DEMO_PW = "Demo1234!"


def auth(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def login(email, pw=DEMO_PW):
    r = requests.post(
        f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10
    )
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def signup(email, name, **extra):
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": DEMO_PW, "name": name, **extra},
        timeout=10,
    )
    assert r.status_code in (200, 201), f"signup {email}: {r.status_code} {r.text}"
    d = r.json()
    return d["token"], d["user"]


# ------------ /auth/me returns username (backfilled) ------------
def test_auth_me_contains_username_for_demo_users():
    for email in ("demo@demo.com", "mei@demo.com", "diego@demo.com"):
        tok = login(email)
        me = requests.get(f"{API}/auth/me", headers=auth(tok), timeout=10).json()
        assert "username" in me and me["username"], f"{email} missing username: {me}"
        # regex sanity: 3-20 chars, lowercase/digits/_/.
        u = me["username"]
        assert 3 <= len(u) <= 20, u
        assert all(c.islower() or c.isdigit() or c in "_." for c in u), u


def test_register_auto_generates_username():
    email = f"i9_reg_{uuid.uuid4().hex[:6]}@demo.com"
    _, user = signup(email, "TEST i9 Reg")
    assert user.get("username")
    assert 3 <= len(user["username"]) <= 20
    assert all(
        c.islower() or c.isdigit() or c in "_." for c in user["username"]
    ), user["username"]


# ------------ Username change: 400/409/429/200 ------------
def test_username_change_invalid_returns_400():
    tok, _ = signup(f"i9_uv_{uuid.uuid4().hex[:6]}@demo.com", "TEST i9 UV")
    # Note: backend lowercases input first, so "UPPER" is accepted as "upper".
    # We test the regex boundaries: too short, whitespace, illegal chars, too long.
    for bad in ("AB", "has space", "ab", "toolong_username_1234567890", "bad@name", "bad-name"):
        r = requests.put(
            f"{API}/users/me/username",
            headers=auth(tok),
            json={"username": bad},
            timeout=10,
        )
        assert r.status_code == 400, f"expected 400 for {bad!r} got {r.status_code} {r.text}"


def test_username_change_success_then_cooldown_429():
    # Fresh user so cooldown starts clean
    tok, user = signup(f"i9_ok_{uuid.uuid4().hex[:6]}@demo.com", "TEST i9 OK")
    new_u = f"testi9_{uuid.uuid4().hex[:6]}"
    r = requests.put(
        f"{API}/users/me/username",
        headers=auth(tok),
        json={"username": new_u},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("username") == new_u, body
    # Immediate second change -> 429
    r2 = requests.put(
        f"{API}/users/me/username",
        headers=auth(tok),
        json={"username": f"another_{uuid.uuid4().hex[:6]}"},
        timeout=10,
    )
    assert r2.status_code == 429, f"expected 429 got {r2.status_code} {r2.text}"
    assert "month" in r2.json().get("detail", "").lower(), r2.text
    # GET /auth/me reflects the new username
    me = requests.get(f"{API}/auth/me", headers=auth(tok), timeout=10).json()
    assert me["username"] == new_u


def test_username_change_duplicate_returns_409():
    # Fresh user A takes a name
    a_tok, _ = signup(f"i9_dup_a_{uuid.uuid4().hex[:6]}@demo.com", "TEST i9 DupA")
    taken = f"testdupe_{uuid.uuid4().hex[:6]}"
    r = requests.put(
        f"{API}/users/me/username",
        headers=auth(a_tok),
        json={"username": taken},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    # Fresh user B tries same
    b_tok, _ = signup(f"i9_dup_b_{uuid.uuid4().hex[:6]}@demo.com", "TEST i9 DupB")
    r2 = requests.put(
        f"{API}/users/me/username",
        headers=auth(b_tok),
        json={"username": taken},
        timeout=10,
    )
    assert r2.status_code == 409, f"expected 409 got {r2.status_code} {r2.text}"


def test_demo_king_cooldown_verification():
    """demo has already changed username to 'demo_king' — cooldown must trigger."""
    tok = login("demo@demo.com")
    me = requests.get(f"{API}/auth/me", headers=auth(tok), timeout=10).json()
    # Only run if the earlier change was recorded; otherwise skip gracefully
    if not me.get("username_changed_at"):
        import pytest

        pytest.skip("demo has no username_changed_at — cooldown not applicable")
    r = requests.put(
        f"{API}/users/me/username",
        headers=auth(tok),
        json={"username": f"try_{uuid.uuid4().hex[:6]}"},
        timeout=10,
    )
    assert r.status_code == 429, f"demo should be in cooldown: {r.status_code} {r.text}"


# ------------ user_card / user_public expose username ------------
def test_user_public_endpoint_includes_username():
    tok = login("demo@demo.com")
    mei_tok = login("mei@demo.com")
    mei_me = requests.get(f"{API}/auth/me", headers=auth(mei_tok), timeout=10).json()
    r = requests.get(f"{API}/users/{mei_me['id']}", headers=auth(tok), timeout=10)
    assert r.status_code == 200
    assert r.json().get("username"), f"other user's public profile missing username: {r.json()}"


def test_partners_list_includes_username():
    tok = login("demo@demo.com")
    r = requests.get(f"{API}/users/partners", headers=auth(tok), timeout=10)
    assert r.status_code == 200
    cards = r.json()
    assert isinstance(cards, list) and len(cards) > 0
    # every card must include username
    missing = [c.get("id") for c in cards if not c.get("username")]
    assert not missing, f"partner cards missing username: {missing[:5]}"


def test_chats_partner_includes_username():
    tok = login("demo@demo.com")
    r = requests.get(f"{API}/chats", headers=auth(tok), timeout=10)
    assert r.status_code == 200
    convs = r.json()
    if not convs:
        import pytest

        pytest.skip("demo has no chats")
    for c in convs:
        p = c.get("partner") or {}
        assert p.get("username"), f"chat partner missing username: {p}"


# ------------ Regression ------------
def test_regression_core_endpoints():
    tok = login("demo@demo.com")
    for path in ("/chats", "/moments", "/rooms", "/users/partners", "/auth/me"):
        r = requests.get(f"{API}{path}", headers=auth(tok), timeout=10)
        assert r.status_code == 200, f"{path} => {r.status_code}"

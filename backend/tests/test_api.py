"""End-to-end API tests against the running backend.

Run: cd /app/backend && python -m pytest tests/ -v
Requires backend running on localhost:8001 and seed data loaded.
"""

import uuid

import requests

BASE = "http://localhost:8001/api"
DEMO = {"email": "demo@demo.com", "password": "Demo1234!"}


def login(creds=DEMO):
    r = requests.post(f"{BASE}/auth/login", json=creds)
    assert r.status_code == 200, r.text
    data = r.json()
    return data["token"], data["user"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_login_me():
    email = f"test-{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": "Pass1234", "name": "Test User"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["token"]
    # duplicate registration rejected
    r2 = requests.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": "Pass1234", "name": "Test User"},
    )
    assert r2.status_code == 400
    # me works
    r3 = requests.get(f"{BASE}/auth/me", headers=auth_headers(token))
    assert r3.status_code == 200
    assert r3.json()["email"] == email
    # wrong password rejected
    r4 = requests.post(
        f"{BASE}/auth/login", json={"email": email, "password": "wrong"}
    )
    assert r4.status_code == 401


def test_me_requires_token():
    r = requests.get(f"{BASE}/auth/me")
    assert r.status_code == 401
    r2 = requests.get(f"{BASE}/auth/me", headers=auth_headers("invalid-token"))
    assert r2.status_code == 401


def test_update_profile():
    token, _ = login()
    r = requests.put(
        f"{BASE}/users/me",
        json={"bio": "Updated bio from tests"},
        headers=auth_headers(token),
    )
    assert r.status_code == 200
    assert r.json()["bio"] == "Updated bio from tests"


def test_partners_listing():
    token, user = login()
    r = requests.get(f"{BASE}/users/partners", headers=auth_headers(token))
    assert r.status_code == 200
    partners = r.json()
    assert len(partners) > 0
    assert all(p["id"] != user["id"] for p in partners)
    # language filter
    r2 = requests.get(
        f"{BASE}/users/partners?language=zh", headers=auth_headers(token)
    )
    assert r2.status_code == 200
    assert all(p["native_language"] == "zh" for p in r2.json())


def test_chat_flow():
    token, user = login()
    token2, partner = login({"email": "mei@demo.com", "password": "Demo1234!"})
    # create or get conversation
    r = requests.post(
        f"{BASE}/chats", json={"partner_id": partner["id"]}, headers=auth_headers(token)
    )
    assert r.status_code == 200, r.text
    conv_id = r.json()["id"]
    # send a message
    r2 = requests.post(
        f"{BASE}/chats/{conv_id}/messages",
        json={"text": "pytest hello"},
        headers=auth_headers(token),
    )
    assert r2.status_code == 201
    # partner sees it with unread > 0
    r3 = requests.get(f"{BASE}/chats", headers=auth_headers(token2))
    conv = next(c for c in r3.json() if c["id"] == conv_id)
    assert conv["unread"] >= 1
    assert conv["last_message"]["text"] == "pytest hello"
    # partner reads
    r4 = requests.post(f"{BASE}/chats/{conv_id}/read", headers=auth_headers(token2))
    assert r4.status_code == 200
    # messages listing
    r5 = requests.get(
        f"{BASE}/chats/{conv_id}/messages", headers=auth_headers(token2)
    )
    assert any(m["text"] == "pytest hello" for m in r5.json())
    # cannot chat with self
    r6 = requests.post(
        f"{BASE}/chats", json={"partner_id": user["id"]}, headers=auth_headers(token)
    )
    assert r6.status_code == 400


def test_moments_flow():
    token, _ = login()
    # create
    r = requests.post(
        f"{BASE}/moments",
        json={"text": f"pytest moment {uuid.uuid4().hex[:6]}"},
        headers=auth_headers(token),
    )
    assert r.status_code == 201
    moment_id = r.json()["id"]
    # like toggle
    r2 = requests.post(f"{BASE}/moments/{moment_id}/like", headers=auth_headers(token))
    assert r2.status_code == 200 and r2.json()["liked"] is True
    r3 = requests.post(f"{BASE}/moments/{moment_id}/like", headers=auth_headers(token))
    assert r3.json()["liked"] is False
    # comment
    r4 = requests.post(
        f"{BASE}/moments/{moment_id}/comments",
        json={"text": "nice one!"},
        headers=auth_headers(token),
    )
    assert r4.status_code == 201
    # detail includes comment
    r5 = requests.get(f"{BASE}/moments/{moment_id}", headers=auth_headers(token))
    detail = r5.json()
    assert detail["comment_count"] == 1
    assert detail["comments"][0]["text"] == "nice one!"
    # feed
    r6 = requests.get(f"{BASE}/moments", headers=auth_headers(token))
    assert any(m["id"] == moment_id for m in r6.json())


def test_ai_translate():
    token, _ = login()
    r = requests.post(
        f"{BASE}/ai/translate",
        json={"text": "Good morning", "target_language": "Spanish"},
        headers=auth_headers(token),
        timeout=60,
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["translated"]) > 0


def test_ai_correct():
    token, _ = login()
    r = requests.post(
        f"{BASE}/ai/correct",
        json={"text": "She go to school yesterday"},
        headers=auth_headers(token),
        timeout=60,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "corrected" in body and len(body["corrected"]) > 0

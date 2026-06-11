"""WebSocket real-time chat tests.

Verifies that /api/ws delivers 'new_message' events when a partner posts a message.
Run: cd /app/backend && python -m pytest tests/test_websocket.py -v
"""

import asyncio
import json

import pytest
import requests
import websockets

BASE = "http://localhost:8001/api"
WS_BASE = "ws://localhost:8001/api/ws"


def _login(email: str, password: str = "Demo1234!"):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    data = r.json()
    return data["token"], data["user"]


@pytest.mark.asyncio
async def test_ws_invalid_token_rejected():
    with pytest.raises(Exception):
        async with websockets.connect(f"{WS_BASE}?token=invalid-token") as ws:
            await asyncio.wait_for(ws.recv(), timeout=3)


@pytest.mark.asyncio
async def test_ws_receives_new_message_event():
    # demo user is the WS client; mei sends the message
    token_demo, user_demo = _login("demo@demo.com")
    token_mei, user_mei = _login("mei@demo.com")

    # Pre-create/get conversation from demo side so it exists
    r = requests.post(
        f"{BASE}/chats",
        json={"partner_id": user_mei["id"]},
        headers={"Authorization": f"Bearer {token_demo}"},
    )
    assert r.status_code == 200, r.text
    conv_id = r.json()["id"]

    async with websockets.connect(f"{WS_BASE}?token={token_demo}") as ws:
        # give server a moment to register the connection
        await asyncio.sleep(0.3)

        # mei sends a message -> demo's WS should receive a new_message event
        r2 = requests.post(
            f"{BASE}/chats/{conv_id}/messages",
            json={"text": "ws hello from mei"},
            headers={"Authorization": f"Bearer {token_mei}"},
        )
        assert r2.status_code == 201, r2.text

        # Wait up to 5s for the event
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
        except asyncio.TimeoutError:
            pytest.fail("Did not receive new_message event over WebSocket within 5s")

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            pytest.fail(f"Non-JSON WS payload: {raw!r}")

        # Accept several common shapes; require 'new_message' marker somewhere
        event_type = payload.get("type") or payload.get("event")
        assert event_type == "new_message", f"Unexpected WS payload: {payload}"

        # message body should be carried in the payload
        msg = payload.get("message") or payload.get("data") or payload
        text = msg.get("text") if isinstance(msg, dict) else None
        assert text == "ws hello from mei", f"Unexpected msg payload: {payload}"

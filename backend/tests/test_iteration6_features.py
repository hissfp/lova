"""Iteration 6 backend tests: /market/topup + moments likers embed + /moments/{id}/likes."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"

DEMO = {"email": "demo@demo.com", "password": "Demo1234!"}
MEI = {"email": "mei@demo.com", "password": "Demo1234!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_token():
    return _login(DEMO)


@pytest.fixture(scope="module")
def mei_token():
    return _login(MEI)


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----- Market topup -----
class TestMarketTopup:
    def test_topup_valid_500_adds_coins(self, demo_token):
        # Get balance
        before = requests.get(f"{BASE_URL}/api/market", headers=_h(demo_token)).json()["coins"]
        r = requests.post(f"{BASE_URL}/api/market/topup", json={"amount": 500}, headers=_h(demo_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "coins" in data
        assert data["coins"] == before + 500

        # Verify persisted via /market GET
        after = requests.get(f"{BASE_URL}/api/market", headers=_h(demo_token)).json()["coins"]
        assert after == before + 500

    def test_topup_all_valid_amounts(self, demo_token):
        for amt in (100, 1000, 2000):
            before = requests.get(f"{BASE_URL}/api/market", headers=_h(demo_token)).json()["coins"]
            r = requests.post(f"{BASE_URL}/api/market/topup", json={"amount": amt}, headers=_h(demo_token))
            assert r.status_code == 200
            assert r.json()["coins"] == before + amt

    def test_topup_invalid_amount_250_returns_400(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/market/topup", json={"amount": 250}, headers=_h(demo_token))
        assert r.status_code == 400

    def test_topup_invalid_amount_0(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/market/topup", json={"amount": 0}, headers=_h(demo_token))
        assert r.status_code == 400

    def test_topup_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/market/topup", json={"amount": 500})
        assert r.status_code in (401, 403)


# ----- Moments likers embed -----
class TestMomentsLikers:
    def test_list_moments_includes_likers(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/moments", headers=_h(demo_token))
        assert r.status_code == 200
        moments = r.json()
        assert isinstance(moments, list) and len(moments) > 0
        for m in moments:
            assert "likers" in m
            assert "like_count" in m
            assert isinstance(m["likers"], list)
            assert len(m["likers"]) <= 6
            for u in m["likers"]:
                # id/name/avatar_url/country
                assert "id" in u
                assert "name" in u
                assert "avatar_url" in u
                assert "country" in u

    def test_moment_detail_includes_likers(self, demo_token):
        moments = requests.get(f"{BASE_URL}/api/moments", headers=_h(demo_token)).json()
        # Find one with likes if possible, else use first
        target = next((m for m in moments if m.get("like_count", 0) > 0), moments[0])
        r = requests.get(f"{BASE_URL}/api/moments/{target['id']}", headers=_h(demo_token))
        assert r.status_code == 200
        d = r.json()
        assert "likers" in d
        assert isinstance(d["likers"], list)
        assert len(d["likers"]) <= 6
        assert "comments" in d

    def test_likes_endpoint_returns_full_cards(self, demo_token, mei_token):
        # Ensure a moment is liked by mei
        moments = requests.get(f"{BASE_URL}/api/moments", headers=_h(demo_token)).json()
        mid = moments[0]["id"]
        # Ensure mei has liked - toggle if not
        detail = requests.get(f"{BASE_URL}/api/moments/{mid}", headers=_h(mei_token)).json()
        if not detail.get("liked_by_me"):
            requests.post(f"{BASE_URL}/api/moments/{mid}/like", headers=_h(mei_token))

        r = requests.get(f"{BASE_URL}/api/moments/{mid}/likes", headers=_h(demo_token))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 1
        u = arr[0]
        # user cards should have richer fields (name, avatar_url, country, is_vip, is_online)
        assert "id" in u
        assert "name" in u
        # user_card returns more fields than the compact likers embed
        for expected in ("avatar_url", "country"):
            assert expected in u

    def test_likes_endpoint_unknown_moment_404(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/moments/nonexistent-id-xyz/likes", headers=_h(demo_token))
        assert r.status_code == 404

    def test_moment_detail_unknown_404(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/moments/nonexistent-id-xyz", headers=_h(demo_token))
        assert r.status_code == 404


# ----- Regression: market buy still works -----
class TestMarketBuyRegression:
    def test_market_catalog_still_returns_items(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/market", headers=_h(demo_token))
        assert r.status_code == 200
        d = r.json()
        assert "coins" in d
        assert "items" in d
        assert len(d["items"]) >= 11
        # Ensure expected VIP items present
        ids = {i["id"] for i in d["items"]}
        assert {"vip_weekly", "vip_monthly", "vip_lifetime"}.issubset(ids)

    def test_buy_bad_item_returns_404(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/market/buy", json={"item_id": "nope_x"}, headers=_h(demo_token))
        assert r.status_code == 404

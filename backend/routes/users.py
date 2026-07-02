from fastapi import APIRouter, HTTPException

from auth_utils import CurrentUser
from db import users_col
from models import UserUpdate, user_card, user_public
from ws_manager import manager

router = APIRouter(prefix="/users", tags=["users"])


@router.put("/me")
async def update_me(body: UserUpdate, current_user: CurrentUser):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await users_col.update_one({"_id": current_user["_id"]}, {"$set": updates})
        current_user.update(updates)
    return user_public(current_user)


@router.get("/partners")
async def list_partners(
    current_user: CurrentUser,
    language: str | None = None,
    search: str | None = None,
):
    """Partners list. Default: users whose native language matches my learning
    language, or who are learning my native language. `language=all` shows everyone."""
    query: dict = {
        "_id": {"$ne": current_user["_id"]},
        "native_language": {"$ne": None},
    }
    if language and language != "all":
        query["native_language"] = language
    elif language != "all":
        my_learning = current_user.get("learning_language")
        my_native = current_user.get("native_language")
        ors = []
        if my_learning:
            ors.append({"native_language": my_learning})
        if my_native:
            ors.append({"learning_language": my_native})
        if ors:
            query["$or"] = ors
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    docs = await users_col.find(query).sort("created_at", -1).to_list(100)
    online_ids = manager.online_user_ids()
    cards = []
    for d in docs:
        card = user_card(d)
        card["is_online"] = d["_id"] in online_ids
        cards.append(card)
    return cards


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: CurrentUser):
    doc = await users_col.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    public = user_public(doc)
    public.pop("email", None)
    public["is_online"] = manager.is_online(user_id)
    return public

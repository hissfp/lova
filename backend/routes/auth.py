import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from auth_utils import CurrentUser, create_access_token, hash_password, verify_password
from db import users_col
from models import LoginRequest, RegisterRequest, user_public

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    user_id = str(uuid.uuid4())
    doc = {
        "_id": user_id,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "bio": None,
        "country": None,
        "avatar_url": None,
        "native_language": None,
        "learning_language": None,
        "proficiency": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await users_col.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email already registered")
    return {"token": create_access_token(user_id), "user": user_public(doc)}


@router.post("/login")
async def login(body: LoginRequest):
    doc = await users_col.find_one({"email": body.email.lower()})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"token": create_access_token(doc["_id"]), "user": user_public(doc)}


@router.get("/me")
async def me(current_user: CurrentUser):
    return user_public(current_user)

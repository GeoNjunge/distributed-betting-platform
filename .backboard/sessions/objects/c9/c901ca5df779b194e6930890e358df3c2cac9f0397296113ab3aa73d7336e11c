from datetime import UTC, datetime, timedelta
import base64
import hashlib
import hmac
import secrets
from uuid import NAMESPACE_DNS, uuid5

import jwt
from fastapi import HTTPException, Request, status
from pydantic import BaseModel, EmailStr

from app.core.config import get_settings


_PBKDF2_ALGORITHM = "sha256"
_PBKDF2_ITERATIONS = 210_000
_SALT_BYTES = 16


class UserRecord(BaseModel):
    user_id: str
    email: EmailStr
    hashed_password: str


# In-memory user store for this standalone service. It is intentionally isolated
# to auth concerns; bet placement endpoints do not mutate betting/database state.
_users_by_email: dict[str, UserRecord] = {}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        _PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        _PBKDF2_ITERATIONS,
    )
    return "pbkdf2_sha256${iterations}${salt}${digest}".format(
        iterations=_PBKDF2_ITERATIONS,
        salt=base64.b64encode(salt).decode("ascii"),
        digest=base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        scheme, iterations_raw, salt_raw, digest_raw = hashed_password.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_raw.encode("ascii"))
        expected = base64.b64decode(digest_raw.encode("ascii"))
        actual = hashlib.pbkdf2_hmac(
            _PBKDF2_ALGORITHM,
            password.encode("utf-8"),
            salt,
            int(iterations_raw),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def create_user(email: EmailStr, password: str) -> UserRecord:
    normalized_email = str(email).lower()
    if normalized_email in _users_by_email:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")
    # Deterministic UUID keeps stateless ingress registration compatible with
    # externally seeded integration-test/database users while still avoiding any
    # direct betting database mutation inside HTTP handlers.
    user = UserRecord(user_id=str(uuid5(NAMESPACE_DNS, normalized_email)), email=normalized_email, hashed_password=hash_password(password))
    _users_by_email[normalized_email] = user
    return user


def authenticate_user(email: EmailStr, password: str) -> UserRecord:
    user = _users_by_email.get(str(email).lower())
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    return user


def create_access_token(user: UserRecord) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims = {
        "sub": user.user_id,
        "email": str(user.email),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
    }
    return jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or expired token") from exc


def current_user_from_request(request: Request) -> UserRecord:
    settings = get_settings()
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing authentication cookie")
    claims = decode_access_token(token)
    user_id = claims.get("sub")
    email = claims.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token claims")
    user = _users_by_email.get(str(email).lower())
    if user is None or user.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user no longer exists")
    return user

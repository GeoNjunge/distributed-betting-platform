import random
from uuid import NAMESPACE_DNS, uuid5

from fastapi import HTTPException, status
from pydantic import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.user_repository import UserRepository
from app.services.redis_service import RedisOTP
from app.services.security import SecurityUtils
from app.services.sms_service import SMSService

_MAX_OTP_ATTEMPTS = 5
_PENDING_TTL = 300


class UserService:
    def __init__(self, session: AsyncSession, redis_otp: RedisOTP, sms: SMSService) -> None:
        self._repo = UserRepository(session)
        self._redis = redis_otp
        self._sms = sms

    async def register_user(
        self,
        email: EmailStr,
        phone: str,
        password: str,
        username: str | None = None,
    ) -> dict[str, str]:
        normalized_email = str(email).lower()
        normalized_phone = SMSService.normalize_phone(phone)

        if await self._repo.get_by_email(normalized_email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")
        if await self._repo.get_by_phone(normalized_phone):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="phone already registered")

        otp = str(random.randint(100000, 999999))
        pending_key = f"registration:pending:{normalized_phone}"
        await self._redis.set_otp(
            pending_key,
            {
                "email": normalized_email,
                "phone": normalized_phone,
                "password_hash": SecurityUtils.hash_password(password),
                "username": username,
                "otp": otp,
            },
            ttl=_PENDING_TTL,
        )
        await self._redis.delete_keys(f"otp_attempts:{normalized_phone}")

        sent = await self._sms.send_otp(normalized_phone, otp)
        if not sent:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="failed to send OTP SMS")

        return {"message": "OTP sent", "phone": normalized_phone}

    async def verify_otp(self, phone: str, otp: str) -> dict[str, str]:
        normalized_phone = SMSService.normalize_phone(phone)
        lock_key = f"lock:verify:{normalized_phone}"
        attempts_key = f"otp_attempts:{normalized_phone}"
        pending_key = f"registration:pending:{normalized_phone}"

        if not await self._redis.acquire_lock(lock_key, ttl=30):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="verification already in progress")

        try:
            attempts = await self._redis.get_attempts(attempts_key)
            if attempts >= _MAX_OTP_ATTEMPTS:
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too many failed OTP attempts")

            pending = await self._redis.get_otp(pending_key)
            if pending is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

            if pending.get("otp") != otp:
                new_attempts = await self._redis.incr_attempts(attempts_key, ttl=_PENDING_TTL)
                if new_attempts >= _MAX_OTP_ATTEMPTS:
                    raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too many failed OTP attempts")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="wrong OTP")

            email = pending["email"]
            user_id = uuid5(NAMESPACE_DNS, email)
            user = await self._repo.create_user(
                {
                    "id": user_id,
                    "email": email,
                    "phone": normalized_phone,
                    "username": pending.get("username"),
                    "password_hash": pending["password_hash"],
                }
            )

            access_token, refresh_token = SecurityUtils.generate_jwt(str(user.id), user.email)
            await self._redis.delete_keys(pending_key, attempts_key)
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
            }
        finally:
            await self._redis.release_lock(lock_key)

    async def login(self, phone: str, password: str) -> dict[str, str]:
        normalized_phone = SMSService.normalize_phone(phone)
        user = await self._repo.get_by_phone(normalized_phone)
        if user is None or not SecurityUtils.verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")

        access_token, refresh_token = SecurityUtils.generate_jwt(str(user.id), user.email)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

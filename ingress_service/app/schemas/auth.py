import re

from pydantic import BaseModel, EmailStr, Field, field_validator


_E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


class UserRegisterRequest(BaseModel):
    email: EmailStr
    phone: str = Field(min_length=8, max_length=16)
    password: str = Field(min_length=12, max_length=256)
    username: str | None = Field(default=None, min_length=3, max_length=128)

    @field_validator("phone")
    @classmethod
    def validate_phone_e164(cls, value: str) -> str:
        cleaned = value.strip().replace(" ", "").replace("-", "")
        if not _E164_PATTERN.match(cleaned):
            raise ValueError("phone must be in E.164 format (e.g. +254712345678)")
        return cleaned


class VerifyOTPRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=16)
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("phone")
    @classmethod
    def validate_phone_e164(cls, value: str) -> str:
        cleaned = value.strip().replace(" ", "").replace("-", "")
        if not _E164_PATTERN.match(cleaned):
            raise ValueError("phone must be in E.164 format (e.g. +254712345678)")
        return cleaned


class UserLoginRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=16)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("phone")
    @classmethod
    def validate_phone_e164(cls, value: str) -> str:
        cleaned = value.strip().replace(" ", "").replace("-", "")
        if not _E164_PATTERN.match(cleaned):
            raise ValueError("phone must be in E.164 format (e.g. +254712345678)")
        return cleaned


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterPendingResponse(BaseModel):
    message: str
    phone: str

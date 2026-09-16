import asyncio
import logging
import re

import africastalking

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


class SMSService:
    def __init__(self) -> None:
        settings = get_settings()
        africastalking.initialize(settings.at_username, settings.at_api_key)
        self._sms = africastalking.SMS
        self._sender_id = settings.at_sender_id

    @staticmethod
    def normalize_phone(phone: str) -> str:
        cleaned = phone.strip().replace(" ", "").replace("-", "")
        if cleaned.startswith("00"):
            cleaned = f"+{cleaned[2:]}"
        if cleaned.startswith("0") and len(cleaned) >= 10:
            cleaned = f"+254{cleaned[1:]}"
        if not cleaned.startswith("+"):
            cleaned = f"+{cleaned}"
        if not _E164_PATTERN.match(cleaned):
            raise ValueError(f"invalid E.164 phone number: {phone}")
        return cleaned

    def _send_sync(self, phone: str, message: str) -> bool:
        kwargs: dict[str, str | list[str]] = {"message": message, "recipients": [phone]}
        if self._sender_id:
            kwargs["sender_id"] = self._sender_id
        response = self._sms.send(**kwargs)
        logger.info("Africa's Talking SMS response for %s: %s", phone, response)
        return True

    async def send_otp(self, phone: str, code: str) -> bool:
        normalized = self.normalize_phone(phone)
        message = f"Your verification code is {code}. It expires in 5 minutes."
        try:
            await asyncio.to_thread(self._send_sync, normalized, message)
            return True
        except Exception:
            logger.exception("failed to send OTP SMS to %s", normalized)
            return False

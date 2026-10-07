"""HTTPS transactional email for hosts whose free plan blocks SMTP."""
from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail.backends.base import BaseEmailBackend


class BrevoEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        if not settings.BREVO_API_KEY:
            if self.fail_silently:
                return 0
            raise ImproperlyConfigured("Set BREVO_API_KEY to enable transactional email.")
        sent = 0
        for message in email_messages:
            if not message.recipients():
                continue
            name, address = parseaddr(message.from_email)
            payload = {
                "sender": {"email": address, **({"name": name} if name else {})},
                "to": [{"email": recipient} for recipient in message.to],
                "subject": message.subject,
                "textContent": message.body,
            }
            for field in ("cc", "bcc"):
                if getattr(message, field):
                    payload[field] = [{"email": recipient} for recipient in getattr(message, field)]
            for alternative in getattr(message, "alternatives", []):
                if alternative[1] == "text/html":
                    payload["htmlContent"] = alternative[0]
            if message.reply_to:
                payload["replyTo"] = {"email": parseaddr(message.reply_to[0])[1]}
            try:
                response = requests.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={"api-key": settings.BREVO_API_KEY, "Accept": "application/json"},
                    json=payload, timeout=settings.EMAIL_TIMEOUT,
                )
                response.raise_for_status()
            except requests.RequestException:
                if not self.fail_silently:
                    # Do not include provider responses, reset links, or credentials in errors.
                    raise RuntimeError("Transactional email delivery failed.") from None
            else:
                sent += 1
        return sent

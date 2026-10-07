import uuid
from datetime import timedelta
from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from accounts.models import Profile, User
from .messages import CONFIRM_SALT, UNSUBSCRIBE_SALT, make_message
from .models import ReminderPreference
from .scheduling import next_due


class ReminderUnavailable(APIException):
    status_code = 503
    default_detail = "Weekly email reminders are temporarily unavailable. Please try again later."


class ConfirmationRateLimit(APIException):
    status_code = 429
    default_detail = "A confirmation email was already requested. Check your inbox or try again in an hour."


def preference_payload(preference):
    return {"available": settings.WEEKLY_EMAIL_ENABLED, "enabled": preference.enabled,
            "confirmed": bool(preference.confirmed_at and preference.confirmed_email == preference.user.email),
            "weekday": preference.weekday, "time": preference.local_time.strftime("%H:%M"),
            "includePhotos": preference.include_photos, "timezone": preference.user.profile.timezone,
            "nextDueAt": preference.next_due_at.isoformat() if preference.next_due_at else None,
            "confirmationSentAt": preference.confirmation_sent_at.isoformat() if preference.confirmation_sent_at else None}


def request_confirmation(user):
    if not settings.WEEKLY_EMAIL_ENABLED:
        raise ReminderUnavailable
    now = timezone.now()
    with transaction.atomic():
        current = User.objects.select_for_update().get(pk=user.pk)
        preference = ReminderPreference.objects.select_for_update().get(user=current)
        if not current.is_active or not preference.enabled:
            raise ValidationError("Enable weekly reminders before requesting confirmation.")
        if preference.confirmed_at and preference.confirmed_email == current.email:
            return preference
        if preference.confirmation_sent_at and preference.confirmation_sent_at > now - timedelta(hours=1):
            raise ConfirmationRateLimit
        preference.confirmation_nonce = uuid.uuid4()
        preference.confirmation_sent_at = now
        preference.save(update_fields=["confirmation_nonce", "confirmation_sent_at", "updated_at"])
        # Durable throttle reservation precedes provider I/O, including timeouts.
        message = make_message(preference, "confirmation")
    try:
        if message.send() != 1:
            raise ReminderUnavailable
    except Exception:
        raise ReminderUnavailable from None
    return preference


def update_preference(user, values):
    if values.get("enabled") and not settings.WEEKLY_EMAIL_ENABLED:
        raise ReminderUnavailable
    confirm = False
    with transaction.atomic():
        current = User.objects.select_for_update().get(pk=user.pk)
        profile = Profile.objects.select_for_update().get(user=current)
        preference, _ = ReminderPreference.objects.select_for_update().get_or_create(user=current)
        was_enabled = preference.enabled
        old_schedule = (preference.weekday, preference.local_time, profile.timezone)
        if "timezone" in values and values["timezone"] != profile.timezone:
            profile.timezone = values["timezone"]
            profile.save(update_fields=["timezone", "updated_at"])
        for key, field in (("enabled", "enabled"), ("weekday", "weekday"), ("time", "local_time"), ("includePhotos", "include_photos")):
            if key in values:
                setattr(preference, field, values[key])
        confirmed = preference.confirmed_at and preference.confirmed_email == current.email
        if not preference.enabled:
            preference.confirmation_nonce = uuid.uuid4()
            preference.confirmed_email = ""
            preference.confirmed_at = None
            preference.next_due_at = None
        elif not was_enabled or not confirmed:
            if not was_enabled:
                preference.unsubscribe_nonce = uuid.uuid4()
            preference.next_due_at = None
            confirm = not was_enabled
        elif old_schedule != (preference.weekday, preference.local_time, profile.timezone):
            preference.next_due_at = next_due(timezone.now(), profile.timezone, preference.weekday, preference.local_time)
        preference.schedule_timezone = profile.timezone
        preference.save()
    return request_confirmation(current) if confirm else preference


def token_action(token, action):
    salt = CONFIRM_SALT if action == "confirm" else UNSUBSCRIBE_SALT
    try:
        payload = signing.loads(token, salt=salt, **({"max_age": 48 * 60 * 60} if action == "confirm" else {}))
        with transaction.atomic():
            current = User.objects.select_for_update().get(pk=payload["uid"])
            preference = ReminderPreference.objects.select_for_update().get(user=current)
            nonce = preference.confirmation_nonce if action == "confirm" else preference.unsubscribe_nonce
            if str(nonce) != payload["nonce"]:
                raise ValueError
            if action == "confirm":
                if not current.is_active or not preference.enabled or payload["email"] != current.email:
                    raise ValueError
                if not preference.confirmed_at or preference.confirmed_email != current.email:
                    preference.confirmed_at = timezone.now()
                    preference.confirmed_email = current.email
                    preference.schedule_timezone = current.profile.timezone
                    preference.next_due_at = next_due(timezone.now(), current.profile.timezone, preference.weekday, preference.local_time)
            else:
                preference.enabled = False
                preference.confirmation_nonce = uuid.uuid4()
                preference.confirmed_at = None
                preference.confirmed_email = ""
                preference.next_due_at = None
            preference.save()
    except (signing.BadSignature, User.DoesNotExist, ReminderPreference.DoesNotExist, KeyError, TypeError, ValueError):
        raise ValidationError("This link is invalid or expired. Open your reminder settings to request a new one.") from None

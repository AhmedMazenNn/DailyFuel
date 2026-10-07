from datetime import datetime, timedelta, timezone as utc_timezone
from zoneinfo import ZoneInfo
from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from accounts.email_backend import EmailDeliveryRejected
from accounts.models import User
from progress.models import WeeklyWeight
from .messages import make_message
from .models import ReminderDailyBudget, ReminderDelivery, ReminderPreference
from .scheduling import local_week, next_due


def complete(preference, week):
    weight = WeeklyWeight.objects.filter(user=preference.user, week_start=week).first()
    return bool(weight and (not preference.include_photos or weight.photos.exists()))


def eligible(preference):
    return (preference.enabled and preference.user.is_active and preference.confirmed_at
            and preference.confirmed_email == preference.user.email)


def candidates(now, limit):
    preferences = ReminderPreference.objects.filter(enabled=True, user__is_active=True,
        confirmed_at__isnull=False, confirmed_email=F("user__email"))
    due = preferences.filter(Q(next_due_at__lte=now) | ~Q(schedule_timezone=F("user__profile__timezone")))
    retry = ReminderDelivery.objects.filter(status=ReminderDelivery.Status.REJECTED, retry_at__lte=now,
                                            attempts__lt=3, week_start__gte=now.date() - timedelta(days=7),
                                            user_id__in=preferences.values("user_id"))
    # Preserve retry/due ordering without duplicating a user's reservation.
    ids = list(retry.order_by("retry_at", "pk").values_list("user_id", flat=True)[:limit])
    ids.extend(due.order_by("next_due_at", "pk").values_list("user_id", flat=True)[:limit])
    return list(dict.fromkeys(ids))[:limit]


def claim(user_id, now):
    """Commit a durable reservation before provider I/O: a crash can't re-send it."""
    with transaction.atomic():
        user = User.objects.select_for_update().filter(pk=user_id).first()
        if not user:
            return None
        preference = ReminderPreference.objects.select_for_update().filter(user=user).first()
        if not preference or not eligible(preference):
            return None
        zone = user.profile.timezone
        if preference.schedule_timezone != zone:
            preference.schedule_timezone = zone
            preference.next_due_at = next_due(now, zone, preference.weekday, preference.local_time)
            preference.save(update_fields=["schedule_timezone", "next_due_at", "updated_at"])
            return None
        week = local_week(now, zone)
        delivery = ReminderDelivery.objects.select_for_update().filter(user=user, week_start=week).first()
        retry = (delivery and delivery.status == ReminderDelivery.Status.REJECTED
                 and delivery.attempts < 3 and delivery.retry_at and delivery.retry_at <= now)
        if not retry and (not preference.next_due_at or preference.next_due_at > now):
            return None
        scheduled = datetime.combine(week + timedelta(days=preference.weekday), preference.local_time,
                                     tzinfo=ZoneInfo(zone)).astimezone(utc_timezone.utc)
        if not retry and scheduled > now:
            # An outage crossed Monday: wait for this week's chosen day instead
            # of delivering an obsolete reminder for the previous week.
            preference.next_due_at = scheduled
            preference.save(update_fields=["next_due_at", "updated_at"])
            return None
        if delivery and not retry:
            preference.next_due_at = next_due(now, zone, preference.weekday, preference.local_time)
            preference.save(update_fields=["next_due_at", "updated_at"])
            return None
        if complete(preference, week):
            if delivery:
                delivery.status = ReminderDelivery.Status.SKIPPED
                delivery.save(update_fields=["status"])
            else:
                ReminderDelivery.objects.create(user=user, week_start=week, recipient=user.email,
                                                status=ReminderDelivery.Status.SKIPPED, attempts=0)
            preference.next_due_at = next_due(now, zone, preference.weekday, preference.local_time)
            preference.save(update_fields=["next_due_at", "updated_at"])
            return None
        # Reserve a UTC-day attempt budget across concurrent worker processes.
        budget, _ = ReminderDailyBudget.objects.get_or_create(date=now.astimezone(utc_timezone.utc).date())
        budget = ReminderDailyBudget.objects.select_for_update().get(pk=budget.pk)
        if budget.attempts >= settings.WEEKLY_EMAIL_DAILY_LIMIT:
            return None
        budget.attempts += 1
        budget.save(update_fields=["attempts"])
        if delivery:
            delivery.status = ReminderDelivery.Status.CLAIMED
            delivery.attempts += 1
            delivery.retry_at = None
            delivery.claimed_at = now
            delivery.recipient = user.email
            delivery.save(update_fields=["status", "attempts", "retry_at", "claimed_at", "recipient"])
        else:
            delivery = ReminderDelivery.objects.create(user=user, week_start=week, recipient=user.email)
            ReminderDelivery.objects.filter(pk=delivery.pk).update(claimed_at=now)
        preference.next_due_at = next_due(now, zone, preference.weekday, preference.local_time)
        preference.save(update_fields=["next_due_at", "updated_at"])
        return delivery.pk


def deliver(delivery_id, now):
    # Use the same lock order as consent/account deletion. Consent revocation
    # before sending cancels the reservation; a send already in flight can't be recalled.
    with transaction.atomic():
        snapshot = ReminderDelivery.objects.filter(pk=delivery_id).first()
        if not snapshot:
            return "skipped"
        user = User.objects.select_for_update().filter(pk=snapshot.user_id).first()
        if not user:
            return "skipped"
        preference = ReminderPreference.objects.select_for_update().filter(user=user).first()
        delivery = ReminderDelivery.objects.select_for_update().filter(pk=delivery_id).first()
        if not delivery or delivery.status != ReminderDelivery.Status.CLAIMED:
            return "skipped"
        if (not preference or not eligible(preference) or delivery.recipient != user.email
                or delivery.week_start != local_week(now, user.profile.timezone)
                or complete(preference, delivery.week_start)):
            delivery.status = ReminderDelivery.Status.SKIPPED
        else:
            try:
                if make_message(preference, "reminder").send() != 1:
                    raise RuntimeError("Email acceptance was not confirmed.")
            except EmailDeliveryRejected:
                delivery.status = ReminderDelivery.Status.REJECTED
                delivery.retry_at = now + timedelta(hours=1) if delivery.attempts < 3 else None
            except Exception:
                # A timeout or 5xx can follow acceptance. Never automatically
                # retry an uncertain delivery, even after restarting the worker.
                delivery.status = ReminderDelivery.Status.UNKNOWN
            else:
                delivery.status = ReminderDelivery.Status.SENT
                delivery.sent_at = now
        delivery.save(update_fields=["status", "retry_at", "sent_at"])
        return delivery.status


def run_reminders(limit=25, dry_run=False, now=None):
    now = now or timezone.now()
    stats = {"considered": 0, "sent": 0, "skipped": 0, "rejected": 0, "unknown": 0, "due": 0}
    if not settings.WEEKLY_EMAIL_ENABLED:
        return {**stats, "disabled": True}
    ids = candidates(now, limit)
    stats["due"] = len(ids)
    if dry_run:
        stats["considered"] = len(ids)
        return stats
    # A process terminated after reservation leaves CLAIMED, not retryable state.
    ReminderDelivery.objects.filter(status=ReminderDelivery.Status.CLAIMED,
                                     claimed_at__lt=now - timedelta(minutes=15)).update(status=ReminderDelivery.Status.UNKNOWN)
    for user_id in ids:
        stats["considered"] += 1
        delivery_id = claim(user_id, now)
        result = deliver(delivery_id, now) if delivery_id else "skipped"
        stats[result] += 1
    return stats

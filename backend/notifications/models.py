import uuid
from datetime import time
from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models


class ReminderPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_reminders")
    enabled = models.BooleanField(default=False)
    weekday = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(6)])
    local_time = models.TimeField(default=time(9))
    # Reminder emails must not mention progress photos unless the user opts in.
    include_photos = models.BooleanField(default=False)
    confirmed_email = models.EmailField(blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmation_nonce = models.UUIDField(default=uuid.uuid4)
    unsubscribe_nonce = models.UUIDField(default=uuid.uuid4)
    confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    next_due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    schedule_timezone = models.CharField(max_length=64, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(weekday__lte=6), name="reminder_valid_weekday")]


class ReminderDelivery(models.Model):
    class Status(models.TextChoices):
        CLAIMED = "claimed"
        SENT = "sent"
        REJECTED = "rejected"
        UNKNOWN = "unknown"
        SKIPPED = "skipped"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    week_start = models.DateField()
    recipient = models.EmailField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.CLAIMED)
    attempts = models.PositiveSmallIntegerField(default=1)
    claimed_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    retry_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "week_start"], name="one_weekly_reminder_per_user")]


class ReminderDailyBudget(models.Model):
    date = models.DateField(primary_key=True)
    attempts = models.PositiveIntegerField(default=0)

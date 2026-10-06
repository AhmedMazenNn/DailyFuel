import uuid
from django.conf import settings
from django.db import models


class WeeklyWeight(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="weekly_weights")
    week_start = models.DateField()
    measured_on = models.DateField()
    weight_kg = models.DecimalField(max_digits=7, decimal_places=3)
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-week_start"]
        constraints = [
            models.UniqueConstraint(fields=["user", "week_start"], name="unique_user_weight_week"),
            models.CheckConstraint(condition=models.Q(weight_kg__gt=0), name="positive_weekly_weight"),
        ]
        indexes = [models.Index(fields=["user", "-week_start"], name="progress_we_user_id_1266ca_idx")]

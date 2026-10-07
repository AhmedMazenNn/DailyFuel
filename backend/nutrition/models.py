import uuid
from django.conf import settings
from django.db import models


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


def amount(**kwargs):
    return models.DecimalField(max_digits=9, decimal_places=2, **kwargs)


class NutritionDay(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    local_date = models.DateField()
    target_calories = amount()
    target_protein_g = amount()
    target_carbohydrate_g = amount(default=0)
    target_fat_g = amount()
    meal_sequence = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-local_date"]
        constraints = [
            models.UniqueConstraint(fields=["user", "local_date"], name="nutrition_unique_day"),
            models.CheckConstraint(condition=models.Q(target_calories__gte=0, target_protein_g__gte=0, target_carbohydrate_g__gte=0, target_fat_g__gte=0), name="nutrition_positive_targets"),
        ]


class Meal(Record):
    nutrition_day = models.ForeignKey(NutritionDay, related_name="meals", on_delete=models.CASCADE)
    name = models.CharField(max_length=80)
    position = models.PositiveIntegerField()
    entry_mode = models.CharField(max_length=12, choices=[("quick", "Quick"), ("itemized", "Itemized")])
    food_notes = models.TextField(blank=True)
    quick_calories = amount(null=True)
    quick_protein_g = amount(null=True)
    quick_carbohydrate_g = amount(null=True, default=None)
    quick_fat_g = amount(null=True)

    class Meta:
        ordering = ["position", "created_at"]
        constraints = [
            models.UniqueConstraint(fields=["nutrition_day", "position"], name="nutrition_meal_position", deferrable=models.Deferrable.DEFERRED),
            models.CheckConstraint(condition=(
                models.Q(entry_mode="quick", quick_calories__isnull=False, quick_protein_g__isnull=False, quick_carbohydrate_g__isnull=False, quick_fat_g__isnull=False, quick_calories__gte=0, quick_protein_g__gte=0, quick_carbohydrate_g__gte=0, quick_fat_g__gte=0)
                | models.Q(entry_mode="itemized", quick_calories__isnull=True, quick_protein_g__isnull=True, quick_carbohydrate_g__isnull=True, quick_fat_g__isnull=True)
            ), name="nutrition_meal_mode"),
        ]


class MealItem(Record):
    meal = models.ForeignKey(Meal, related_name="items", on_delete=models.CASCADE)
    saved_food = models.ForeignKey("SavedFood", null=True, blank=True, on_delete=models.SET_NULL, related_name="meal_items")
    source_type = models.CharField(max_length=20, choices=[("manual", "Manual"), ("saved_food", "Saved food")], default="manual")
    name = models.CharField(max_length=120)
    amount_g = amount(null=True, blank=True)
    serving_amount_snapshot_g = amount(null=True, blank=True)
    position = models.PositiveIntegerField()
    calories = amount()
    protein_g = amount()
    carbohydrate_g = amount(default=0)
    fat_g = amount()
    carbs_g = amount(null=True, blank=True)

    class Meta:
        ordering = ["position", "created_at"]
        constraints = [
            models.UniqueConstraint(fields=["meal", "position"], name="nutrition_item_position", deferrable=models.Deferrable.DEFERRED),
            models.CheckConstraint(condition=models.Q(calories__gte=0, protein_g__gte=0, carbohydrate_g__gte=0, fat_g__gte=0), name="nutrition_positive_items"),
        ]


class DailyLogReward(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nutrition_day = models.OneToOneField(NutritionDay, on_delete=models.CASCADE)
    points_awarded = models.PositiveIntegerField(default=10)


class SavedFood(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_foods")
    name = models.CharField(max_length=120)
    brand = models.CharField(max_length=120, blank=True)
    serving_amount_g = amount()
    calories_per_serving = amount()
    protein_g_per_serving = amount()
    fat_g_per_serving = amount()
    carbs_g_per_serving = amount(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["name", "created_at"]
        constraints = [models.CheckConstraint(condition=models.Q(serving_amount_g__gt=0, calories_per_serving__gte=0, protein_g_per_serving__gte=0, fat_g_per_serving__gte=0), name="saved_food_positive_serving")]


class Achievement(models.Model):
    code = models.CharField(max_length=50, primary_key=True)
    title_en = models.CharField(max_length=100)
    title_ar = models.CharField(max_length=100)
    description_en = models.CharField(max_length=250)
    description_ar = models.CharField(max_length=250)
    logged_days_required = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)


class UserAchievement(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    achievement = models.ForeignKey(Achievement, on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "achievement"], name="nutrition_unique_achievement")]


class GamificationProfile(Record):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    xp_total = models.PositiveBigIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)


class IdempotencyRecord(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    key = models.CharField(max_length=200)
    fingerprint = models.CharField(max_length=64)
    response = models.JSONField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "key"], name="nutrition_unique_idempotency")]

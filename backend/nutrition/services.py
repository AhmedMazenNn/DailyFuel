"""All writes lock the owning user first, serializing day creation and retry keys."""
import hashlib
import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from accounts.services import local_today
from .models import (Achievement, DailyLogReward, GamificationProfile, IdempotencyRecord,
                     Meal, MealItem, NutritionDay, UserAchievement)

DAILY_XP = 10
LEVEL_XP = 100
MILESTONES = (("first", 1), ("seven", 7), ("thirty", 30))
KEYS = ("calories", "protein", "fat")


def lock_user(user):
    get_user_model().objects.select_for_update().get(pk=user.pk)


def inherited_targets(user, date):
    previous = NutritionDay.objects.filter(user=user, local_date__lt=date).first()
    if previous:
        return dict(zip(KEYS, (previous.target_calories, previous.target_protein_g, previous.target_fat_g)))
    profile = user.profile
    if not profile.onboarding_complete:
        raise ValidationError({"targets": ["Complete initial target setup first."]})
    return dict(zip(KEYS, (profile.initial_calories, profile.initial_protein, profile.initial_fat)))


def get_day(user, date):
    day = NutritionDay.objects.filter(user=user, local_date=date).first()
    if day is None:
        values = inherited_targets(user, date)
        day = NutritionDay.objects.create(user=user, local_date=date, target_calories=values["calories"],
                                          target_protein_g=values["protein"], target_fat_g=values["fat"])
    return day


def numbers(values):
    return {key: float(values[key]) for key in KEYS}


def meal_totals(meal, items):
    if meal.entry_mode == "quick":
        totals = dict(zip(KEYS, (meal.quick_calories, meal.quick_protein_g, meal.quick_fat_g)))
    else:
        totals = {key: sum((getattr(item, attr) for item in items), Decimal("0")) for key, attr in
                  zip(KEYS, ("calories", "protein_g", "fat_g"))}
    return totals


def meal_data(meal):
    items = list(meal.items.all())
    totals = meal_totals(meal, items)
    return {
        "id": str(meal.pk), "date": meal.nutrition_day.local_date.isoformat(), "name": meal.name,
        "mode": meal.entry_mode, "note": meal.food_notes, "totals": numbers(totals),
        "items": [{"id": str(item.pk), "name": item.name, "position": item.position,
                   **numbers(dict(zip(KEYS, (item.calories, item.protein_g, item.fat_g))))} for item in items],
        "createdAt": meal.created_at.isoformat(), "position": meal.position,
    }


def day_data(user, date, day=None):
    day = day or NutritionDay.objects.filter(user=user, local_date=date).first()
    targets = dict(zip(KEYS, (day.target_calories, day.target_protein_g, day.target_fat_g))) if day else inherited_targets(user, date)
    records = list(day.meals.select_related("nutrition_day").prefetch_related("items")) if day else []
    meals = [meal_data(meal) for meal in records]
    values = [meal_totals(meal, list(meal.items.all())) for meal in records]
    totals = {key: sum((value[key] for value in values), Decimal("0")) for key in KEYS}
    return {"date": date.isoformat(), "targets": numbers(targets), "totals": numbers(totals),
            "remaining": numbers({key: targets[key] - totals[key] for key in KEYS}),
            "meals": meals, "nextMealNumber": day.meal_sequence + 1 if day else 1}


def save_meal(day, data, meal=None):
    creating = meal is None
    mode = data.get("mode", meal.entry_mode if meal else "quick")
    if mode == "itemized" and (creating or meal.entry_mode != mode) and not data.get("items"):
        raise ValidationError({"items": ["Itemized meals require at least one item."]})
    if mode == "quick" and (creating or meal.entry_mode != mode) and "totals" not in data:
        raise ValidationError({"totals": ["Enter combined totals for this meal."]})
    if mode == "quick" and data.get("items"):
        raise ValidationError({"items": ["Quick meals cannot contain itemized foods."]})
    if creating:
        day.meal_sequence += 1
        day.save(update_fields=["meal_sequence", "updated_at"])
        last = day.meals.order_by("-position").first()
        meal = Meal(nutrition_day=day, position=last.position + 1 if last else 0,
                    name=f"Meal {day.meal_sequence}")
    if data.get("name"):
        meal.name = data["name"]
    meal.entry_mode = mode
    meal.food_notes = data.get("note", meal.food_notes)
    if mode == "quick":
        totals = data.get("totals")
        if totals:
            meal.quick_calories, meal.quick_protein_g, meal.quick_fat_g = (totals[k] for k in KEYS)
    else:
        meal.quick_calories = meal.quick_protein_g = meal.quick_fat_g = None
    meal.save()
    if mode == "quick":
        meal.items.all().delete()
    elif "items" in data:
        existing = {item.pk: item for item in meal.items.all()}
        supplied_ids = [item["id"] for item in data["items"] if "id" in item]
        if len(supplied_ids) != len(set(supplied_ids)) or any(pk not in existing for pk in supplied_ids):
            raise ValidationError({"items": ["Item IDs must be unique and belong to this meal."]})
        meal.items.exclude(pk__in=supplied_ids).delete()
        for position, entry in enumerate(data["items"]):
            item = existing.get(entry.get("id")) or MealItem(meal=meal)
            item.position = position
            item.name = entry["name"]
            item.calories, item.protein_g, item.fat_g = (entry[k] for k in KEYS)
            item.save()
    reconcile_rewards(day.user)
    return meal


def reorder(queryset, ids):
    objects = list(queryset)
    if len(ids) != len(set(ids)) or set(ids) != {obj.pk for obj in objects}:
        raise ValidationError({"ids": ["Supply every current ID exactly once."]})
    positions = {pk: position for position, pk in enumerate(ids)}
    for obj in objects:
        obj.position = positions[obj.pk]
    queryset.model.objects.bulk_update(objects, ["position"])


def retry_record(user, date, key, payload):
    if not key:
        return None, None
    if len(key) > 200:
        raise ValidationError({"Idempotency-Key": ["Maximum length is 200 characters."]})
    fingerprint = hashlib.sha256(json.dumps({"date": date.isoformat(), "payload": payload}, sort_keys=True,
                                            separators=(",", ":")).encode()).hexdigest()
    previous = IdempotencyRecord.objects.filter(user=user, key=key).first()
    if previous and previous.fingerprint != fingerprint:
        raise ValidationError({"Idempotency-Key": ["This key was already used for a different request."]})
    return previous, fingerprint


def reconcile_rewards(user):
    today = local_today(user)
    days = NutritionDay.objects.filter(user=user, local_date__lte=today, meals__isnull=False).distinct()
    for day in days:
        DailyLogReward.objects.get_or_create(user=user, nutrition_day=day, defaults={"points_awarded": DAILY_XP})
    count = DailyLogReward.objects.filter(user=user).count()
    for code, threshold in MILESTONES:
        if count >= threshold:
            achievement, _ = Achievement.objects.get_or_create(code=code, defaults={
                "title_en": f"{threshold} logged days", "title_ar": f"{threshold} أيام مسجلة",
                "description_en": "A milestone for logging meals.", "description_ar": "إنجاز لتسجيل الوجبات.",
                "logged_days_required": threshold})
            UserAchievement.objects.get_or_create(user=user, achievement=achievement)
    profile, _ = GamificationProfile.objects.get_or_create(user=user)
    dates = list(days.order_by("local_date").values_list("local_date", flat=True))
    run = longest = 0
    previous = None
    for date in dates:
        run = run + 1 if previous and date == previous + timedelta(days=1) else 1
        longest = max(longest, run)
        previous = date
    active = run if previous in (today, today - timedelta(days=1)) else 0
    profile.xp_total = DailyLogReward.objects.filter(user=user).aggregate(total=Sum("points_awarded"))["total"] or 0
    profile.longest_streak = max(profile.longest_streak, longest)
    profile.save()
    xp = profile.xp_total
    return {"xp": xp, "level": xp // LEVEL_XP + 1, "levelProgress": xp % LEVEL_XP,
            "xpToNext": LEVEL_XP - xp % LEVEL_XP, "streak": active,
            "longestStreak": profile.longest_streak, "loggedDays": count,
            "earned": list(UserAchievement.objects.filter(user=user).values_list("achievement_id", flat=True))}

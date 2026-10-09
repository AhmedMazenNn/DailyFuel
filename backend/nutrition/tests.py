from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from .models import DailyLogReward, Meal, NutritionDay, UserAchievement, SavedFood, MealItem
from accounts.test_helpers import verify_test_user


class NutritionTests(TransactionTestCase):
    def setUp(self):
        self.user = verify_test_user(get_user_model().objects.create_user(email="nutrition@example.com", password="SecureTest123!"))
        profile = self.user.profile
        profile.initial_calories = Decimal("2000")
        profile.initial_protein = Decimal("120")
        profile.initial_fat = Decimal("60")
        profile.onboarding_complete = True
        profile.save()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.day = "2026-01-05"
        self.url = f"/api/v1/nutrition-days/{self.day}/"
        self.draft = {"mode": "quick", "totals": {"calories": "100.10", "protein": "10.25", "fat": "2.50"}}

    def post(self, data=None, **headers):
        return self.client.post(self.url + "meals/", data or self.draft, format="json", **headers)

    def test_lazy_decimal_inheritance_and_historical_snapshot(self):
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertFalse(NutritionDay.objects.exists())
        self.assertEqual(self.post().status_code, 201)
        next_url = "/api/v1/nutrition-days/2026-01-06/"
        self.client.put(next_url, {"targets": {"calories": "1800.25", "protein": 100, "fat": 50}}, format="json")
        self.client.put(self.url, {"targets": {"calories": 0, "protein": 0, "fat": 0}}, format="json")
        self.assertEqual(self.client.get(next_url).data["targets"]["calories"], 1800.25)
        data = self.client.get(self.url).data
        self.assertEqual(data["remaining"]["calories"], -100.1)
        self.assertEqual(NutritionDay.objects.get(local_date=self.day).meals.get().quick_protein_g, Decimal("10.25"))
        self.assertEqual(self.post({"mode": "quick", "totals": {"calories": -1, "protein": 1, "fat": 1}}).status_code, 400)
        self.assertEqual(self.post({"mode": "quick", "totals": {"calories": "1.001", "protein": 1, "fat": 1}}).status_code, 400)

    def test_itemization_transitions_and_reordering(self):
        first = self.post().data
        second = self.post().data
        meal_url = f"/api/v1/meals/{first['id']}/"
        self.assertEqual(self.client.patch(meal_url, {"mode": "itemized"}, format="json").status_code, 400)
        converted = self.client.patch(meal_url, {"mode": "itemized", "totals": {"calories": 999, "protein": 999, "fat": 999},
                                    "items": [{"name": "A", "calories": "10.10", "protein": 1, "fat": 2},
                                              {"name": "B", "calories": "20.20", "protein": 3, "fat": 4}]}, format="json")
        self.assertEqual(converted.status_code, 200)
        self.assertEqual(converted.data["totals"]["calories"], 30.3)
        self.assertIsNone(Meal.objects.get(pk=first["id"]).quick_calories)
        item_ids = [item["id"] for item in converted.data["items"]]
        self.assertEqual(self.client.post(meal_url + "items/reorder/", {"ids": item_ids[::-1]}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/v1/meal-items/{item_ids[0]}/", {"calories": "0.25"}, format="json").data["totals"]["calories"], 20.45)
        self.assertEqual(self.client.delete(f"/api/v1/meal-items/{item_ids[1]}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/v1/meal-items/{item_ids[0]}/").status_code, 400)
        self.assertEqual(self.client.post(self.url + "meals/reorder/", {"ids": [second["id"], first["id"]]}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(meal_url, self.draft, format="json").status_code, 200)
        self.assertFalse(Meal.objects.get(pk=first["id"]).items.exists())
        self.client.delete(meal_url)
        self.assertEqual(self.post().data["name"], "Meal 3")

    def test_itemized_create_and_edit_with_new_and_saved_items(self):
        food = {"name": "Rice", "calories": "130.50", "protein": "2.50", "fat": "0.30"}
        created = self.post({"mode": "itemized", "items": [food]})
        self.assertEqual(created.status_code, 201)
        saved = created.data["items"][0]
        meal_url = f"/api/v1/meals/{created.data['id']}/"
        edited = self.client.patch(meal_url, {"items": [
            {**food, "name": "Egg", "calories": "70.25"},
            {**saved, "calories": "150.00"},
        ]}, format="json")
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.data["items"][1]["id"], saved["id"])
        self.assertNotEqual(edited.data["items"][0]["id"], saved["id"])
        self.assertEqual(edited.data["totals"]["calories"], 220.25)
        self.assertEqual(self.client.get(self.url).data["totals"]["calories"], 220.25)
        duplicate = self.client.patch(meal_url, {"items": [saved, saved]}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(self.client.get(meal_url).data["items"], edited.data["items"])

    def test_saved_food_decimal_formula_ownership_archive_and_snapshot(self):
        response = self.client.post("/api/v1/saved-foods/", {
            "name": "Oats", "serving_amount_g": "40.00", "calories_per_serving": "150.00",
            "protein_g_per_serving": "5.00", "fat_g_per_serving": "3.00", "carbs_g_per_serving": "27.00",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        food_id = response.data["id"]
        meal = self.post({"mode": "itemized", "items": [{"name": "placeholder", "calories": 1, "protein": 1, "fat": 1}]}).data
        used = self.client.post(f"/api/v1/meals/{meal['id']}/items/from-saved-food/", {"saved_food_id": food_id, "amount_g": "60.00"}, format="json")
        self.assertEqual(used.status_code, 201)
        item = MealItem.objects.get(saved_food_id=food_id)
        self.assertEqual(item.calories, Decimal("225.00")); self.assertEqual(item.protein_g, Decimal("7.50")); self.assertEqual(item.fat_g, Decimal("4.50"))
        self.assertEqual(used.data["totals"]["calories"], 226.0)
        self.client.patch(f"/api/v1/saved-foods/{food_id}/", {"calories_per_serving": "155.00"}, format="json")
        self.assertEqual(MealItem.objects.get(pk=item.pk).calories, Decimal("225.00"))
        self.assertEqual(self.client.delete(f"/api/v1/saved-foods/{food_id}/").status_code, 204)
        self.assertEqual(self.client.get(f"/api/v1/meals/{meal['id']}/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/v1/meals/{meal['id']}/items/from-saved-food/", {"saved_food_id": food_id, "amount_g": 60}, format="json").status_code, 404)

    def test_saved_food_in_meal_create_rescale_and_archived_history(self):
        food = SavedFood.objects.create(user=self.user, name="Oats", serving_amount_g=40,
            calories_per_serving=150, protein_g_per_serving=5, fat_g_per_serving=3)
        created = self.post({"mode": "itemized", "items": [{"saved_food_id": str(food.pk), "amount_g": "60.00"}]})
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["totals"]["calories"], 225)
        item = created.data["items"][0]
        url = f"/api/v1/meals/{created.data['id']}/"
        self.client.patch(f"/api/v1/saved-foods/{food.pk}/", {"calories_per_serving": 900}, format="json")
        self.client.delete(f"/api/v1/saved-foods/{food.pk}/")
        draft = {"id": item["id"], "saved_food_id": str(food.pk), "amount_g": "60.00"}
        unchanged = self.client.patch(url, {"name": "Breakfast", "items": [draft]}, format="json")
        self.assertEqual(unchanged.status_code, 200, unchanged.data)
        self.assertEqual(unchanged.data["totals"]["calories"], 225)
        changed = self.client.patch(url, {"items": [{**draft, "amount_g": "30.00"}]}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["totals"]["calories"], 112.5)
        self.assertEqual(changed.data["items"][0]["amountG"], 30)
        self.assertEqual(self.client.get(self.url).data["totals"]["calories"], 112.5)
        self.assertEqual(self.post({"mode": "itemized", "items": [draft | {"id": item["id"]}]}).status_code, 400)
        self.assertEqual(self.post({"mode": "itemized", "items": [{"saved_food_id": str(food.pk), "amount_g": 30}]}).status_code, 400)

    def test_saved_food_portion_validation_and_owner_scope(self):
        other = get_user_model().objects.create_user(email="food-other@example.com", password="SecureTest123!")
        food = SavedFood.objects.create(user=other, name="Private", serving_amount_g=100,
            calories_per_serving=100, protein_g_per_serving=10, fat_g_per_serving=5)
        food_url = f"/api/v1/saved-foods/{food.pk}/"
        for response in [self.client.get(food_url), self.client.patch(food_url, {"name": "Hijack"}, format="json"), self.client.delete(food_url)]:
            self.assertEqual(response.status_code, 404)
        self.assertEqual(self.post({"mode": "itemized", "items": [{"saved_food_id": str(food.pk), "amount_g": 50}]}).status_code, 400)
        food.user = self.user
        food.save()
        for amount in (0, -1, "NaN", "0.001"):
            self.assertEqual(self.post({"mode": "itemized", "items": [{"saved_food_id": str(food.pk), "amount_g": amount}]}).status_code, 400)
        created = self.post({"mode": "itemized", "items": [{"saved_food_id": str(food.pk), "amount_g": "33.33", "calories": 9999}]})
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["totals"]["calories"], 33.33)
        self.assertEqual(created.data["totals"]["protein"], 3.33)

    def test_owner_scope_and_history(self):
        meal = self.post().data
        other = verify_test_user(get_user_model().objects.create_user(email="other@example.com", password="SecureTest123!"))
        self.client.force_authenticate(other)
        url = f"/api/v1/meals/{meal['id']}/"
        for response in [self.client.get(url), self.client.patch(url, {"name": "Hijack"}, format="json"), self.client.delete(url)]:
            self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get("/api/v1/history/").data["count"], 0)
        self.client.force_authenticate(self.user)
        for i in range(32):
            self.client.put(f"/api/v1/nutrition-days/{date(2025, 1, 1) + timedelta(days=i)}/",
                            {"targets": {"calories": 1, "protein": 1, "fat": 1}}, format="json")
        history = self.client.get("/api/v1/history/")
        self.assertEqual(history.data["count"], 33)
        self.assertEqual(len(history.data["results"]), 31)
        self.assertIsNotNone(history.data["next"])
        self.assertEqual(self.client.get("/api/v1/history/?from=2026-01-05&to=2026-01-05").data["count"], 1)
        self.assertEqual(self.client.get("/api/v1/history/?from=garbage").status_code, 400)

    def test_rewards_survive_deletion_future_dates_wait_and_streak_expires(self):
        with patch("nutrition.services.local_today", return_value=date(2026, 1, 5)):
            meal = self.post(HTTP_IDEMPOTENCY_KEY="once").data
            self.post(HTTP_IDEMPOTENCY_KEY="once")
            self.assertEqual(self.post({"name": "Changed", **self.draft}, HTTP_IDEMPOTENCY_KEY="once").status_code, 400)
            future_url = "/api/v1/nutrition-days/2026-01-06/meals/"
            self.client.post(future_url, self.draft, format="json")
            rewards = self.client.get("/api/v1/gamification/").data
            self.assertEqual((rewards["xp"], rewards["streak"]), (10, 1))
            self.assertEqual(DailyLogReward.objects.count(), 1)
        with patch("nutrition.services.local_today", return_value=date(2026, 1, 6)):
            rewards = self.client.get("/api/v1/gamification/").data
            self.assertEqual((rewards["xp"], rewards["streak"]), (20, 2))
            self.client.delete(f"/api/v1/meals/{meal['id']}/")
            rewards = self.client.get("/api/v1/gamification/").data
            self.assertEqual((rewards["xp"], rewards["streak"], rewards["longestStreak"]), (20, 1, 2))
        with patch("nutrition.services.local_today", return_value=date(2026, 1, 8)):
            self.assertEqual(self.client.get("/api/v1/gamification/").data["streak"], 0)
        self.assertEqual(UserAchievement.objects.count(), 1)

    def test_concurrent_same_key_creates_single_meal_and_reward(self):
        self.assertEqual(connection.vendor, "postgresql", "These integrity tests require PostgreSQL.")
        user_id = self.user.pk

        def create():
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(get_user_model().objects.get(pk=user_id))
                return client.post(self.url + "meals/", self.draft, format="json", HTTP_IDEMPOTENCY_KEY="parallel")
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=4) as pool:
            responses = list(pool.map(lambda _: create(), range(4)))
        self.assertEqual([r.status_code for r in responses], [201] * 4)
        self.assertEqual(len({r.data["id"] for r in responses}), 1)
        self.assertEqual(Meal.objects.count(), 1)
        self.assertEqual(NutritionDay.objects.count(), 1)
        self.assertEqual(DailyLogReward.objects.count(), 1)

    def test_anonymous_access_and_atomic_invalid_item_ids(self):
        anonymous = APIClient()
        self.assertIn(anonymous.get(self.url).status_code, (401, 403))
        first = self.post({"mode": "itemized", "items": [
            {"name": "Food", "calories": 1, "protein": 2, "fat": 3}
        ]}).data
        second = self.post({"mode": "itemized", "items": [
            {"name": "Other", "calories": 4, "protein": 5, "fat": 6}
        ]}).data
        response = self.client.patch(f"/api/v1/meals/{first['id']}/",
                                    {"name": "Changed", "items": second["items"]}, format="json")
        self.assertEqual(response.status_code, 400)
        retained = self.client.get(f"/api/v1/meals/{first['id']}/").data
        self.assertEqual(retained["name"], first["name"])
        self.assertEqual(retained["items"], first["items"])
        bad = self.post({"mode": "itemized", "items": []})
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(self.client.get(self.url).data["nextMealNumber"], 3)

    def test_save_returns_current_snapshots_including_idempotent_replay(self):
        first = self.post(HTTP_IDEMPOTENCY_KEY="snapshot")
        self.assertEqual(first.data["day"]["totals"]["calories"], 100.1)
        self.assertEqual(first.data["gamification"]["xp"], 10)
        second = self.post()
        replay = self.post(HTTP_IDEMPOTENCY_KEY="snapshot")
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(replay.data["day"], second.data["day"])
        edited = self.client.patch(f"/api/v1/meals/{first.data['id']}/", {
            "totals": {"calories": "200", "protein": 10, "fat": 2}
        }, format="json")
        self.assertEqual(edited.data["day"]["totals"]["calories"], 300.1)
        self.assertEqual(edited.data["gamification"]["xp"], 10)

    def test_save_query_count_does_not_grow_with_rewarded_history_or_items(self):
        from django.test.utils import CaptureQueriesContext

        self.post()
        with CaptureQueriesContext(connection) as initial:
            self.assertEqual(self.post().status_code, 201)
        for i in range(39):
            day = NutritionDay.objects.create(
                user=self.user, local_date=date(2025, 1, 1) + timedelta(days=i),
                target_calories=2000, target_protein_g=100, target_fat_g=60,
            )
            Meal.objects.create(
                nutrition_day=day, name="Prior", position=0, entry_mode="quick",
                quick_calories=1, quick_protein_g=1, quick_carbohydrate_g=1, quick_fat_g=1,
            )
            DailyLogReward.objects.create(user=self.user, nutrition_day=day)
        self.client.get("/api/v1/gamification/")
        with CaptureQueriesContext(connection) as historical:
            self.assertEqual(self.post().status_code, 201)
        self.assertEqual(len(historical), len(initial))
        food = {"name": "Food", "calories": 1, "protein": 1, "fat": 1}
        with CaptureQueriesContext(connection) as one_item:
            self.assertEqual(self.post({"mode": "itemized", "items": [food]}).status_code, 201)
        with CaptureQueriesContext(connection) as many_items:
            result = self.post({"mode": "itemized", "items": [food] * 40})
        self.assertEqual(result.status_code, 201)
        self.assertEqual(len(many_items), len(one_item))
        self.assertEqual(result.data["totals"]["calories"], 40)
        with CaptureQueriesContext(connection) as unchanged:
            self.client.get("/api/v1/gamification/")
        self.assertFalse(any(query["sql"].lstrip().upper().startswith(("UPDATE", "INSERT", "DELETE"))
                             for query in unchanged))

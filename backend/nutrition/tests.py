from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from .models import DailyLogReward, Meal, NutritionDay, UserAchievement


class NutritionTests(TransactionTestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="nutrition@example.com", password="SecureTest123!")
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

    def test_owner_scope_and_history(self):
        meal = self.post().data
        other = get_user_model().objects.create_user(email="other@example.com", password="SecureTest123!")
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

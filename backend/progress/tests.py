from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import WeeklyWeight
from accounts.test_helpers import verify_test_user


class WeightTests(TestCase):
    def setUp(self):
        self.user = verify_test_user(get_user_model().objects.create_user(email="weight@example.com", password="StrongWeightPass123!"))
        self.other = verify_test_user(get_user_model().objects.create_user(email="other@example.com", password="StrongWeightPass123!"))
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = "/api/v1/progress/weeks/2026-10-05/weight/"

    def test_weight_only_upsert_and_decimal_storage(self):
        first = self.client.put(self.url, {"weightKg": "72.125", "measuredOn": "2026-10-06"}, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["photos"], [])
        second = self.client.put(self.url, {"weightKg": "73.250"}, format="json")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(WeeklyWeight.objects.count(), 1)
        self.assertEqual(WeeklyWeight.objects.get().weight_kg, Decimal("73.250"))
        self.assertEqual(WeeklyWeight.objects.get().measured_on, date(2026, 10, 6))

    def test_dates_and_weight_validation(self):
        for weight in (0, -1, "NaN", "Infinity", "10000.000", "1.2345"):
            response = self.client.put(self.url, {"weightKg": weight}, format="json")
            self.assertEqual(response.status_code, 400, (weight, response.data))
        response = self.client.put(self.url, {"weightKg": 70, "measuredOn": "2026-10-12"}, format="json")
        self.assertEqual(response.status_code, 400)
        for invalid in ("2026-10-06", "bad-date", "2026-02-30"):
            self.assertEqual(self.client.get(f"/api/v1/progress/weeks/{invalid}/").status_code, 400)

    def test_private_empty_reads_do_not_create_and_preferences_do_not_change_weight(self):
        self.assertEqual(self.client.get(self.url).data["weightKg"], None)
        self.assertEqual(WeeklyWeight.objects.count(), 0)
        self.client.put(self.url, {"weightKg": 70}, format="json")
        self.user.profile.timezone = "Pacific/Auckland"
        self.user.profile.save()
        self.assertEqual(WeeklyWeight.objects.get().week_start, date(2026, 10, 5))
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).data["weightKg"], None)
        self.assertEqual(self.client.get("/api/v1/progress/weeks/").data["results"], [])
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))

    def test_private_photo_view_delete_and_upload_replacement(self):
        from io import BytesIO
        from tempfile import TemporaryDirectory
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        from .models import ProgressPhoto

        def image():
            buffer = BytesIO()
            Image.new("RGB", (40, 60), "blue").save(buffer, format="PNG")
            return SimpleUploadedFile("progress.png", buffer.getvalue(), content_type="image/png")

        with TemporaryDirectory() as media, self.settings(PRIVATE_MEDIA_ROOT=media):
            self.client.put(self.url, {"weightKg": 70}, format="json")
            upload_url = "/api/v1/progress/weeks/2026-10-05/photos/"
            photos = []
            for _ in range(4):
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post(upload_url, {"image": image()}, format="multipart")
                self.assertEqual(response.status_code, 201, response.data)
                photos.append(response.data)
            self.assertEqual(self.client.post(upload_url, {"image": image()}, format="multipart").status_code, 400)
            first = photos[0]
            self.assertEqual(self.client.get(first["url"]).status_code, 200)
            self.client.force_authenticate(self.other)
            self.assertEqual(self.client.get(first["url"]).status_code, 404)
            self.assertEqual(self.client.delete(f"/api/v1/progress/photos/{first['id']}/").status_code, 404)
            self.client.force_authenticate(self.user)
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.client.delete(f"/api/v1/progress/photos/{first['id']}/").status_code, 204)
            self.assertEqual(self.client.get(first["url"]).status_code, 404)
            self.assertEqual(ProgressPhoto.objects.count(), 3)
            self.assertEqual(WeeklyWeight.objects.get().weight_kg, Decimal("70"))
            with self.captureOnCommitCallbacks(execute=True):
                replacement = self.client.post(upload_url, {"image": image()}, format="multipart")
            self.assertEqual(replacement.status_code, 201, replacement.data)
            self.assertEqual(ProgressPhoto.objects.count(), 4)

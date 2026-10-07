from django.test import TestCase
from rest_framework.test import APIClient
from .models import User


class SignOutTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("logout@example.com", "StrongSessionPassword123!")
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(self.user)

    def test_sign_out_ends_session_and_private_access(self):
        self.client.get("/api/v1/auth/csrf/")
        token = self.client.cookies["csrftoken"].value
        response = self.client.post("/api/v1/auth/logout/", {}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get("/api/v1/auth/session/").data["user"], None)
        self.assertEqual(self.client.get("/api/v1/profile/").status_code, 403)

    def test_missing_csrf_does_not_sign_user_out(self):
        response = self.client.post("/api/v1/auth/logout/", {})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get("/api/v1/auth/session/").data["user"]["id"], str(self.user.pk))

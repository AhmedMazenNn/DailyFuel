from unittest.mock import Mock, patch

import requests
from django.core.mail import EmailMessage
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from .email_backend import BrevoEmailBackend
from .models import User


class AuthenticationDeploymentTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def test_anonymous_auth_writes_require_csrf(self):
        for path in ("register", "login", "password/reset", "password/reset/confirm"):
            response = self.client.post(f"/api/v1/auth/{path}/", {}, format="json")
            self.assertEqual(response.status_code, 403, path)
        self.assertFalse(User.objects.exists())

    def test_csrf_cookie_registration_and_session_work_through_proxy(self):
        with override_settings(
            DEBUG=False, ALLOWED_HOSTS=["backend.example", "app.example"],
            CSRF_TRUSTED_ORIGINS=["https://app.example"],
            SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
            SECURE_SSL_REDIRECT=True, SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True,
        ):
            proxy = {"HTTP_HOST": "backend.example", "HTTP_X_FORWARDED_PROTO": "https"}
            response = self.client.get("/api/v1/auth/csrf/", **proxy)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.cookies["csrftoken"]["secure"])
            token = self.client.cookies["csrftoken"].value
            response = self.client.post("/api/v1/auth/register/", {
                "email": "proxy@example.com", "password": "StrongReleasePass123!", "name": "Test",
            }, format="json", HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://app.example", **proxy)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertTrue(response.cookies["sessionid"]["secure"])
            self.assertTrue(response.cookies["sessionid"]["httponly"])
            self.assertEqual(self.client.get("/api/v1/auth/session/", **proxy).data["user"]["email"], "proxy@example.com")

    def test_valid_token_cannot_authorize_untrusted_origin(self):
        self.client.get("/api/v1/auth/csrf/")
        token = self.client.cookies["csrftoken"].value
        response = self.client.post("/api/v1/auth/login/", {}, format="json",
                                    HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://evil.example")
        self.assertEqual(response.status_code, 403)

    def test_personalized_responses_are_never_shared_cached(self):
        for path in ("csrf", "session", "config"):
            response = self.client.get(f"/api/v1/auth/{path}/")
            self.assertEqual(response["Cache-Control"], "private, no-store")
            self.assertIn("Cookie", response["Vary"])


@override_settings(BREVO_API_KEY="test-server-only-key", EMAIL_TIMEOUT=15)
class TransactionalEmailTests(SimpleTestCase):
    @patch("accounts.email_backend.requests.post")
    def test_delivery_uses_https_server_credentials_and_verified_sender(self, post):
        post.return_value = Mock()
        message = EmailMessage("Reset", "Use this reset link", "DailyFuel <sender@example.com>", ["user@example.com"])
        self.assertEqual(BrevoEmailBackend().send_messages([message]), 1)
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://api.brevo.com/v3/smtp/email")
        self.assertEqual(kwargs["headers"]["api-key"], "test-server-only-key")
        self.assertEqual(kwargs["json"]["sender"]["email"], "sender@example.com")
        self.assertEqual(kwargs["timeout"], 15)

    @patch("accounts.email_backend.requests.post", side_effect=requests.Timeout("secret upstream context"))
    def test_provider_failure_does_not_expose_sensitive_context(self, post):
        message = EmailMessage("Reset", "secret-link", "sender@example.com", ["user@example.com"])
        with self.assertRaisesRegex(RuntimeError, "^Transactional email delivery failed.$"):
            BrevoEmailBackend().send_messages([message])
        self.assertEqual(BrevoEmailBackend(fail_silently=True).send_messages([message]), 0)

from unittest.mock import patch
from html import unescape
from urllib.parse import urlsplit, parse_qs

from allauth.account.models import EmailAddress, EmailConfirmationHMAC
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import User
from .verification import send_verification


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='https://app.example')
class AuthEmailTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user('email@example.com', 'OriginalPassword123!')

    def test_registration_sends_verification_and_preserves_session(self):
        response = self.client.post('/api/v1/auth/register/', {'email': 'new@example.com', 'password': 'NewStrongPassword123!'})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['user']['emailVerified'])
        self.assertTrue(response.data['user']['verificationEmailSent'])
        self.assertIn('https://app.example/?verify_email=', mail.outbox[0].body)

    def test_confirm_requires_post_and_token_is_single_use(self):
        send_verification(self.user)
        address = EmailAddress.objects.get(user=self.user)
        token = EmailConfirmationHMAC(address).key
        self.assertEqual(self.client.get('/api/v1/auth/email/verify/', {'token': token}).status_code, 405)
        address.refresh_from_db()
        self.assertFalse(address.verified)
        self.assertEqual(self.client.post('/api/v1/auth/email/verify/', {'token': token}).status_code, 200)
        address.refresh_from_db()
        self.assertTrue(address.verified)
        self.assertEqual(self.client.post('/api/v1/auth/email/verify/', {'token': token}).status_code, 400)

    def test_expired_changed_address_and_invalid_tokens_rejected(self):
        send_verification(self.user)
        token = EmailConfirmationHMAC(EmailAddress.objects.get(user=self.user)).key
        with override_settings(ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS=-1):
            self.assertEqual(self.client.post('/api/v1/auth/email/verify/', {'token': token}).status_code, 400)
        self.user.email = 'changed@example.com'
        self.user.save()
        for value in (token, 'bad'):
            self.assertEqual(self.client.post('/api/v1/auth/email/verify/', {'token': value}).status_code, 400)

    def test_resend_is_authenticated_and_limited(self):
        self.assertEqual(self.client.post('/api/v1/auth/email/resend/').status_code, 403)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/v1/auth/email/resend/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/email/resend/').status_code, 429)
        self.assertEqual(len(mail.outbox), 1)

    def test_reset_and_reuse(self):
        response = self.client.post('/api/v1/auth/password/reset/', {'email': self.user.email})
        self.assertEqual(response.status_code, 200)
        reset_url = mail.outbox[0].body.split()[-1]
        html = unescape(mail.outbox[0].alternatives[0].content)
        self.assertIn(f'href="{reset_url}"', html)
        self.assertNotIn('unsubscribe', html)
        params = {k: v[0] for k, v in parse_qs(urlsplit(reset_url).query).items()}
        params['password'] = 'ReplacementPassword123!'
        self.assertEqual(self.client.post('/api/v1/auth/password/reset/confirm/', params).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/password/reset/confirm/', params).status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(params['password']))

    @patch('accounts.views.send_mail', side_effect=RuntimeError('private provider response'))
    def test_reset_failure_and_unknown_account_have_same_response(self, send):
        known = self.client.post('/api/v1/auth/password/reset/', {'email': self.user.email})
        unknown = self.client.post('/api/v1/auth/password/reset/', {'email': 'unknown@example.com'})
        self.assertEqual(known.status_code, 200)
        self.assertEqual(known.data, unknown.data)

    def test_csrf_required_for_confirmation(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/v1/auth/email/verify/', {'token': 'bad'}).status_code, 403)

    def test_arabic_reset_has_rtl_html_and_plain_text(self):
        self.user.profile.locale = 'ar'
        self.user.profile.save()
        response = self.client.post('/api/v1/auth/password/reset/', {'email': self.user.email})
        self.assertEqual(response.status_code, 200)
        message = mail.outbox[0]
        self.assertIn('إعادة تعيين كلمة المرور', message.body)
        self.assertIn('dir="rtl"', message.alternatives[0].content)
        self.assertIn('lang=ar', message.body)

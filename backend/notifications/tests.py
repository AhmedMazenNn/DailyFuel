from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import patch

from django.core import mail
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import User
from accounts.test_helpers import verify_test_user
from accounts.email_backend import EmailDeliveryRejected, EmailDeliveryUncertain
from .messages import confirmation_token, unsubscribe_token, make_message
from .models import ReminderPreference, ReminderDelivery, ReminderDailyBudget
from .preferences import update_preference, token_action, request_confirmation, ConfirmationRateLimit, ReminderUnavailable
from .scheduling import next_due, local_week

NOW = datetime(2026, 10, 5, 9, 0, tzinfo=timezone.utc)
EMAIL_SETTINGS = dict(WEEKLY_EMAIL_ENABLED=True, EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
                      FRONTEND_URL='https://dailyfuel.example', WEEKLY_EMAIL_DAILY_LIMIT=200,
                      PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])


class ScheduleTests(SimpleTestCase):
    def test_due_is_strict_future_at_equal_time(self):
        self.assertEqual(next_due(NOW, 'UTC', 0, time(9)), NOW + timedelta(days=7))

    def test_local_week_uses_user_day_at_utc_boundary(self):
        instant = datetime(2026, 10, 4, 23, tzinfo=timezone.utc)
        self.assertEqual(local_week(instant, 'Asia/Tokyo'), date(2026, 10, 5))
        self.assertEqual(local_week(instant, 'America/Los_Angeles'), date(2026, 9, 28))

    def test_spring_gap_and_autumn_fold_choose_one_real_instant(self):
        spring = next_due(datetime(2026, 3, 28, tzinfo=timezone.utc), 'Europe/Berlin', 6, time(2, 30))
        self.assertEqual(spring, datetime(2026, 3, 29, 1, 30, tzinfo=timezone.utc))
        autumn = next_due(datetime(2026, 10, 24, tzinfo=timezone.utc), 'Europe/Berlin', 6, time(2, 30))
        self.assertEqual(autumn, datetime(2026, 10, 25, 0, 30, tzinfo=timezone.utc))


@override_settings(**EMAIL_SETTINGS)
class ConsentTests(TestCase):
    def setUp(self):
        self.user = verify_test_user(User.objects.create_user('reminder@example.com', 'password'))

    def enable(self):
        return update_preference(self.user, {'enabled': True})

    def test_opt_in_requires_email_confirmation_then_has_future_schedule(self):
        preference = self.enable()
        self.assertTrue(preference.enabled)
        self.assertIsNone(preference.confirmed_at)
        self.assertIsNone(preference.next_due_at)
        self.assertEqual(len(mail.outbox), 1)
        with patch('notifications.preferences.timezone.now', return_value=NOW):
            token_action(confirmation_token(preference), 'confirm')
        preference.refresh_from_db()
        self.assertEqual(preference.confirmed_email, self.user.email)
        self.assertEqual(preference.next_due_at, NOW + timedelta(days=7))

    def test_confirmation_resend_is_throttled_even_after_delivery_failure(self):
        with patch('notifications.preferences.make_message') as message:
            message.return_value.send.side_effect = EmailDeliveryUncertain('timeout')
            self.assertRaises(ReminderUnavailable, self.enable)
        preference = ReminderPreference.objects.get(user=self.user)
        self.assertIsNotNone(preference.confirmation_sent_at)
        self.assertRaises(ConfirmationRateLimit, request_confirmation, self.user)

    def test_changed_email_invalidates_pending_confirmation(self):
        preference = self.enable()
        token = confirmation_token(preference)
        self.user.email = 'replacement@example.com'
        self.user.save()
        self.assertRaises(ValidationError, token_action, token, 'confirm')
        preference.refresh_from_db()
        self.assertIsNone(preference.confirmed_at)

    def test_unsubscribe_invalidates_confirmation_and_old_unsubscribe_after_reenable(self):
        preference = self.enable()
        confirm, unsubscribe = confirmation_token(preference), unsubscribe_token(preference)
        token_action(unsubscribe, 'unsubscribe')
        preference.refresh_from_db()
        self.assertFalse(preference.enabled)
        self.assertIsNone(preference.next_due_at)
        self.assertRaises(ValidationError, token_action, confirm, 'confirm')
        preference.confirmation_sent_at = NOW - timedelta(days=30)
        preference.save()
        self.enable()
        self.assertRaises(ValidationError, token_action, unsubscribe, 'unsubscribe')

    def test_confirmation_expired_after_48_hours(self):
        preference = self.enable()
        with patch('django.core.signing.time.time', return_value=1000000):
            token = confirmation_token(preference)
        with patch('django.core.signing.time.time', return_value=1000000 + 48 * 3600 + 1):
            self.assertRaises(ValidationError, token_action, token, 'confirm')

    def test_tampered_capability_cannot_change_another_user(self):
        preference = self.enable()
        token = unsubscribe_token(preference)
        other = User.objects.create_user('another@example.com', 'password')
        other_preference = ReminderPreference.objects.create(user=other, enabled=True)
        self.assertRaises(ValidationError, token_action, token + 'tampered', 'unsubscribe')
        other_preference.refresh_from_db()
        preference.refresh_from_db()
        self.assertTrue(other_preference.enabled)
        self.assertTrue(preference.enabled)

    def test_schedule_edit_recalculates_due_without_resetting_confirmation(self):
        preference = self.enable()
        token_action(confirmation_token(preference), 'confirm')
        with patch('notifications.preferences.timezone.now', return_value=NOW):
            updated = update_preference(self.user, {'weekday': 2, 'time': time(15, 30), 'timezone': 'Asia/Tokyo'})
        self.assertEqual(updated.confirmed_email, self.user.email)
        self.assertEqual(updated.next_due_at, datetime(2026, 10, 7, 6, 30, tzinfo=timezone.utc))
        self.assertEqual(len(mail.outbox), 1)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.timezone, 'Asia/Tokyo')

    def test_message_contains_no_weight_photo_or_attachment(self):
        preference = self.enable()
        message = make_message(preference, 'reminder')
        self.assertEqual(message.to, [self.user.email])
        self.assertEqual(message.attachments, [])
        self.assertIn('/progress', message.body)
        self.assertIn('/email-preferences/unsubscribe?', message.body)
        self.assertNotIn('weightKg', message.body)
        self.assertNotIn('/api/v1/progress/photos/', message.body)
        html = message.alternatives[0].content
        self.assertIn('href="https://dailyfuel.example/progress"', html)
        self.assertIn('/email-preferences/unsubscribe?', html)
        self.assertIn('opted in', html)
        self.assertNotIn('/api/v1/progress/photos/', html)
        self.assertNotIn('weightKg', html)
        self.assertNotIn('progress photos', html)
        preference.include_photos = True
        self.assertIn('progress photos', make_message(preference, 'reminder').alternatives[0].content)
        self.user.profile.locale = 'ar'
        self.user.profile.save()
        preference.user = self.user
        translated = make_message(preference, 'reminder')
        self.assertIn('dir="rtl"', translated.alternatives[0].content)


@override_settings(**EMAIL_SETTINGS)
class ReminderAPITests(TestCase):
    def setUp(self):
        self.user = verify_test_user(User.objects.create_user('api-reminder@example.com', 'password'))
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = '/api/v1/email-reminders/'

    def test_default_opt_out_and_owner_scoping(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data['enabled'])
        self.assertFalse(response.data['confirmed'])
        self.client.patch(self.url, {'enabled': True}, format='json')
        other = User.objects.create_user('other-reminder@example.com', 'password')
        self.client.force_authenticate(other)
        self.assertFalse(self.client.get(self.url).data['enabled'])
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))

    def test_schedule_validation_rejects_bad_zone_time_and_weekday(self):
        for payload in ({'weekday': 7}, {'weekday': -1}, {'time': '25:00'}, {'timezone': 'Mars/Olympus'}, {'enabled': 'not-a-boolean'}):
            response = self.client.patch(self.url, payload, format='json')
            self.assertEqual(response.status_code, 400, (payload, response.data))

    def test_provider_disabled_does_not_accept_opt_in(self):
        with self.settings(WEEKLY_EMAIL_ENABLED=False):
            self.assertFalse(self.client.get(self.url).data['available'])
            self.assertEqual(self.client.patch(self.url, {'enabled': True}, format='json').status_code, 503)

    def test_email_link_get_requests_never_mutate_and_anonymous_post_requires_csrf(self):
        preference = update_preference(self.user, {'enabled': True})
        secure = APIClient(enforce_csrf_checks=True)
        for action, token in (('confirm', confirmation_token(preference)), ('unsubscribe', unsubscribe_token(preference))):
            url = f'{self.url}{action}/'
            self.assertEqual(secure.get(url, {'token': token}).status_code, 405)
            self.assertEqual(secure.post(url, {'token': token}, format='json').status_code, 403)
        preference.refresh_from_db()
        self.assertTrue(preference.enabled)
        self.assertIsNone(preference.confirmed_at)


@override_settings(**EMAIL_SETTINGS)
class ReminderWorkerTests(TestCase):
    def setUp(self):
        self.user = verify_test_user(User.objects.create_user('worker-reminder@example.com', 'password'))
        self.preference = ReminderPreference.objects.create(
            user=self.user, enabled=True, confirmed_email=self.user.email, confirmed_at=NOW - timedelta(days=10),
            next_due_at=NOW, schedule_timezone='UTC', include_photos=True,
        )

    def run_worker(self, **kwargs):
        from .worker import run_reminders
        return run_reminders(now=kwargs.pop('now', NOW), **kwargs)

    def test_send_once_per_local_week_even_if_schedule_moves_back(self):
        first = self.run_worker()
        self.assertEqual(first['sent'], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.preference.refresh_from_db()
        self.assertGreater(self.preference.next_due_at, NOW)
        self.preference.next_due_at = NOW
        self.preference.save()
        self.run_worker()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(ReminderDelivery.objects.count(), 1)
        self.assertEqual(ReminderDelivery.objects.get().status, 'sent')

    def test_pending_or_inactive_or_changed_email_receives_nothing(self):
        for field, value in [('confirmed_at', None), ('enabled', False), ('confirmed_email', 'old@example.com')]:
            original = getattr(self.preference, field)
            setattr(self.preference, field, value)
            self.preference.save()
            self.assertEqual(self.run_worker()['sent'], 0)
            setattr(self.preference, field, original)
            self.preference.save()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.run_worker()['sent'], 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_completed_weight_and_photo_skips_but_weight_without_photo_sends(self):
        from progress.models import WeeklyWeight, ProgressPhoto
        weight = WeeklyWeight.objects.create(user=self.user, week_start=date(2026, 10, 5), measured_on=date(2026, 10, 5), weight_kg='75.125')
        ProgressPhoto.objects.create(weight=weight, captured_on=date(2026, 10, 5), position=0,
                                     file_key='private-original', thumbnail_key='private-thumbnail')
        self.assertEqual(self.run_worker()['sent'], 0)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(ReminderDelivery.objects.get().status, 'skipped')

    def test_weight_only_setting_counts_weight_as_complete(self):
        from progress.models import WeeklyWeight
        WeeklyWeight.objects.create(user=self.user, week_start=date(2026, 10, 5), measured_on=date(2026, 10, 5), weight_kg='75.125')
        self.preference.include_photos = False
        self.preference.save()
        self.assertEqual(self.run_worker()['sent'], 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_weight_only_does_not_complete_photo_reminder(self):
        from progress.models import WeeklyWeight
        WeeklyWeight.objects.create(user=self.user, week_start=date(2026, 10, 5), measured_on=date(2026, 10, 5), weight_kg='75.125')
        self.assertEqual(self.run_worker()['sent'], 1)

    def test_dry_run_has_no_database_or_email_changes(self):
        before = self.preference.next_due_at
        self.run_worker(dry_run=True)
        self.preference.refresh_from_db()
        self.assertEqual(self.preference.next_due_at, before)
        self.assertEqual(ReminderDelivery.objects.count(), 0)
        self.assertEqual(ReminderDailyBudget.objects.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_disabled_worker_fails_closed(self):
        with self.settings(WEEKLY_EMAIL_ENABLED=False):
            self.assertEqual(self.run_worker()['sent'], 0)
        self.assertFalse(ReminderDelivery.objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_daily_budget_blocks_provider_and_retains_due(self):
        ReminderDailyBudget.objects.create(date=NOW.date(), attempts=200)
        self.assertEqual(self.run_worker()['sent'], 0)
        self.preference.refresh_from_db()
        self.assertEqual(self.preference.next_due_at, NOW)
        self.assertEqual(len(mail.outbox), 0)

    def test_unknown_provider_acceptance_is_never_automatically_retried(self):
        with patch('notifications.worker.make_message') as message:
            message.return_value.send.side_effect = EmailDeliveryUncertain('ambiguous timeout')
            self.run_worker()
        delivery = ReminderDelivery.objects.get()
        self.assertEqual(delivery.status, 'unknown')
        self.assertEqual(delivery.attempts, 1)
        self.preference.next_due_at = NOW
        self.preference.save()
        self.run_worker(now=NOW + timedelta(hours=2))
        delivery.refresh_from_db()
        self.assertEqual(delivery.attempts, 1)
        self.assertEqual(len(mail.outbox), 0)

    def test_explicit_rejection_retries_after_delay_only(self):
        with patch('notifications.worker.make_message') as message:
            message.return_value.send.side_effect = EmailDeliveryRejected('explicit rejection')
            self.run_worker()
        delivery = ReminderDelivery.objects.get()
        self.assertEqual(delivery.status, 'rejected')
        self.assertGreaterEqual(delivery.retry_at, NOW + timedelta(hours=1))
        self.run_worker(now=NOW + timedelta(minutes=30))
        self.assertEqual(len(mail.outbox), 0)
        self.run_worker(now=NOW + timedelta(hours=2))
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'sent')
        self.assertEqual(delivery.attempts, 2)
        self.assertEqual(len(mail.outbox), 1)

    def test_timezone_change_reschedules_instead_of_sending_stale_due(self):
        self.user.profile.timezone = 'Asia/Tokyo'
        self.user.profile.save()
        self.assertEqual(self.run_worker()['sent'], 0)
        self.preference.refresh_from_db()
        self.assertEqual(self.preference.schedule_timezone, 'Asia/Tokyo')
        self.assertGreater(self.preference.next_due_at, NOW)
        self.assertEqual(len(mail.outbox), 0)

    def test_revocation_after_claim_cancels_delivery(self):
        from .worker import claim, deliver
        reservation = claim(self.user.pk, NOW)
        self.assertIsNotNone(reservation)
        token_action(unsubscribe_token(self.preference), 'unsubscribe')
        self.assertEqual(deliver(reservation, NOW), 'skipped')
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(ReminderDelivery.objects.get().status, 'skipped')

    def test_crash_after_reservation_becomes_unknown_without_resend(self):
        from .worker import claim
        claim(self.user.pk, NOW)
        self.run_worker(now=NOW + timedelta(minutes=16))
        self.assertEqual(ReminderDelivery.objects.get().status, 'unknown')
        self.assertEqual(len(mail.outbox), 0)

    def test_explicit_rejections_stop_after_three_attempts(self):
        with patch('notifications.worker.make_message') as message:
            message.return_value.send.side_effect = EmailDeliveryRejected('provider rejected')
            for offset in range(4):
                self.run_worker(now=NOW + timedelta(hours=offset))
            self.assertEqual(message.return_value.send.call_count, 3)
        delivery = ReminderDelivery.objects.get()
        self.assertEqual(delivery.attempts, 3)
        self.assertIsNone(delivery.retry_at)
        self.assertEqual(ReminderDailyBudget.objects.get().attempts, 3)


@override_settings(BREVO_API_KEY='test-private-key', EMAIL_TIMEOUT=15)
class ProviderFailureTests(SimpleTestCase):
    def test_explicit_4xx_rejection_and_uncertain_5xx_are_distinguished(self):
        import requests
        from django.core.mail import EmailMessage
        from accounts.email_backend import BrevoEmailBackend
        message = EmailMessage('Reminder', 'Private content', 'sender@example.com', ['recipient@example.com'])
        for status, expected in ((400, EmailDeliveryRejected), (429, EmailDeliveryRejected), (500, EmailDeliveryUncertain), (503, EmailDeliveryUncertain)):
            response = requests.Response()
            response.status_code = status
            response.url = 'https://api.brevo.com/v3/smtp/email'
            response._content = b'PRIVATE provider response'
            with patch('accounts.email_backend.requests.post', return_value=response):
                with self.assertRaises(expected) as failure:
                    BrevoEmailBackend().send_messages([message])
            self.assertNotIn('PRIVATE', str(failure.exception))
            self.assertNotIn('test-private-key', str(failure.exception))

    def test_timeout_is_uncertain_and_not_leaked(self):
        import requests
        from django.core.mail import EmailMessage
        from accounts.email_backend import BrevoEmailBackend
        message = EmailMessage('Reminder', 'Private content', 'sender@example.com', ['recipient@example.com'])
        with patch('accounts.email_backend.requests.post', side_effect=requests.Timeout('PRIVATE provider secret')):
            with self.assertRaises(EmailDeliveryUncertain) as failure:
                BrevoEmailBackend().send_messages([message])
        self.assertNotIn('PRIVATE', str(failure.exception))


@override_settings(**EMAIL_SETTINGS)
class ConcurrentClaimTests(TransactionTestCase):
    """Separate PostgreSQL connections contend for durable reservations."""

    def create_due_user(self, email):
        user = User.objects.create_user(email, 'password')
        ReminderPreference.objects.create(
            user=user, enabled=True, confirmed_email=user.email,
            confirmed_at=NOW - timedelta(days=10), next_due_at=NOW,
            schedule_timezone='UTC', include_photos=True,
        )
        return user

    def simultaneous_claims(self, user_ids):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import connection, connections
        from .worker import claim
        if connection.vendor != 'postgresql':
            self.skipTest('Real PostgreSQL row locking is required.')
        barrier = Barrier(len(user_ids))

        def reserve(user_id):
            # Django connections are thread-local. Force each thread to open its
            # own database session before releasing the contenders together.
            connections.close_all()
            try:
                with connections['default'].cursor() as cursor:
                    cursor.execute('SET statement_timeout = 10000')
                    cursor.execute('SELECT pg_backend_pid()')
                    session_id = cursor.fetchone()[0]
                barrier.wait(timeout=10)
                return session_id, claim(user_id, NOW)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=len(user_ids)) as executor:
            futures = [executor.submit(reserve, user_id) for user_id in user_ids]
            outcomes = [future.result(timeout=20) for future in futures]
        self.assertEqual(len({session for session, _ in outcomes}), len(user_ids))
        return [reservation for _, reservation in outcomes]

    def test_same_user_concurrent_claims_reserve_only_one_provider_opportunity(self):
        from .worker import deliver
        user = self.create_due_user('concurrent-same@example.com')
        reservations = self.simultaneous_claims([user.pk, user.pk])
        successful = [reservation for reservation in reservations if reservation is not None]
        self.assertEqual(len(successful), 1)
        self.assertEqual(ReminderDelivery.objects.filter(user=user).count(), 1)
        self.assertEqual(ReminderDailyBudget.objects.get(date=NOW.date()).attempts, 1)
        self.assertEqual(deliver(successful[0], NOW), 'sent')
        self.assertEqual(deliver(successful[0], NOW), 'skipped')
        self.assertEqual(len(mail.outbox), 1)

    def test_different_users_contend_for_last_daily_budget_slot(self):
        users = [self.create_due_user(f'concurrent-{index}@example.com') for index in range(2)]
        ReminderDailyBudget.objects.create(date=NOW.date(), attempts=199)
        reservations = self.simultaneous_claims([user.pk for user in users])
        self.assertEqual(sum(reservation is not None for reservation in reservations), 1)
        self.assertEqual(ReminderDelivery.objects.count(), 1)
        self.assertEqual(ReminderDailyBudget.objects.get(date=NOW.date()).attempts, 200)
        remaining = ReminderPreference.objects.filter(next_due_at=NOW)
        self.assertEqual(remaining.count(), 1)

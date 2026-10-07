from datetime import date
from unittest.mock import Mock, patch

from allauth.account.models import EmailAddress
from django.contrib import admin
from django.contrib.admin.models import CHANGE, DELETION, LogEntry
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Permission
from django.core.exceptions import PermissionDenied
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse

from progress.models import MediaDeletion, ProgressPhoto, WeeklyWeight
from .models import Profile, User


class AccountAdminTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin@example.com", "StrongAdminPass123!")
        self.member = User.objects.create_user("member@example.com", "StrongMemberPass123!")
        Profile.objects.filter(user=self.member).update(display_name="Member")
        self.client.force_login(self.admin)

    def change_url(self, user):
        return reverse("admin:accounts_user_change", args=[user.pk])

    def delete_url(self, user):
        return reverse("admin:accounts_user_delete", args=[user.pk])

    def edit_data(self, user, **changes):
        response = self.client.get(self.change_url(user))
        self.assertEqual(response.status_code, 200)
        inline = response.context["inline_admin_formsets"][0].formset
        prefix = inline.prefix
        profile = user.profile
        data = {
            "email": user.email,
            "is_active": "on",
            "_save": "Save",
            f"{prefix}-TOTAL_FORMS": "1",
            f"{prefix}-INITIAL_FORMS": "1",
            f"{prefix}-MIN_NUM_FORMS": "0",
            f"{prefix}-MAX_NUM_FORMS": "1",
            f"{prefix}-0-id": str(profile.pk),
            f"{prefix}-0-user": str(user.pk),
            f"{prefix}-0-display_name": profile.display_name,
            f"{prefix}-0-timezone": profile.timezone,
            f"{prefix}-0-locale": profile.locale,
            f"{prefix}-0-weight_unit": profile.weight_unit,
        }
        data.update(changes)
        return data, prefix

    def test_only_active_superusers_can_manage_accounts_even_with_staff_permissions(self):
        staff = User.objects.create_user("staff@example.com", is_staff=True)
        staff.user_permissions.set(Permission.objects.filter(content_type__app_label="accounts"))
        normal = User.objects.create_user("normal@example.com")
        inactive = User.objects.create_superuser("inactive@example.com", is_active=False)
        for actor in (staff, normal, inactive):
            self.client.force_login(actor)
            for url in (reverse("admin:accounts_user_changelist"), self.change_url(self.member), self.delete_url(self.member)):
                response = self.client.get(url)
                self.assertIn(response.status_code, (302, 403), (actor.email, url))
            response = self.client.post(self.change_url(self.member), {"email": "hijacked@example.com", "is_active": "on"})
            self.assertIn(response.status_code, (302, 403))
            response = self.client.post(self.delete_url(self.member), {"post": "yes"})
            self.assertIn(response.status_code, (302, 403))
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, "member@example.com")

    def test_user_list_search_and_bulk_deletion_are_safe(self):
        response = self.client.get(reverse("admin:accounts_user_changelist"), {"q": "member@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(response.context["cl"].result_list), [self.member])
        self.assertIsNone(response.context["action_form"])
        self.assertIn(self.client.get(reverse("admin:accounts_user_add")).status_code, (302, 403))

    def test_account_and_profile_edit_sync_email_without_preserving_verification(self):
        EmailAddress.objects.create(user=self.member, email=self.member.email, primary=True, verified=True)
        data, prefix = self.edit_data(self.member, email="UPDATED@EXAMPLE.COM")
        data.update({f"{prefix}-0-display_name": "Updated", f"{prefix}-0-timezone": "Africa/Cairo",
                     f"{prefix}-0-locale": "ar", f"{prefix}-0-weight_unit": "lb"})
        response = self.client.post(self.change_url(self.member), data)
        self.assertEqual(response.status_code, 302, response.content)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, "updated@example.com")
        self.assertTrue(self.member.check_password("StrongMemberPass123!"))
        self.assertEqual(self.member.profile.display_name, "Updated")
        self.assertEqual(self.member.profile.timezone, "Africa/Cairo")
        self.assertEqual(self.member.profile.locale, "ar")
        self.assertEqual(self.member.profile.weight_unit, "lb")
        self.assertFalse(EmailAddress.objects.filter(user=self.member, email="member@example.com").exists())
        address = EmailAddress.objects.get(user=self.member, email="updated@example.com")
        self.assertTrue(address.primary)
        self.assertFalse(address.verified)
        self.assertTrue(LogEntry.objects.filter(user=self.admin, object_id=str(self.member.pk), action_flag=CHANGE).exists())

    def test_case_insensitive_duplicate_email_is_a_form_error_not_a_server_error(self):
        data, _ = self.edit_data(self.member, email=self.admin.email.upper())
        response = self.client.post(self.change_url(self.member), data)
        self.assertEqual(response.status_code, 200)
        self.assertIn("email", response.context["adminform"].form.errors)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, "member@example.com")

    def test_admin_cannot_deactivate_or_delete_any_superuser(self):
        other = User.objects.create_superuser("other-admin@example.com")
        for target in (self.admin, other):
            data, _ = self.edit_data(target)
            del data["is_active"]
            response = self.client.post(self.change_url(target), data)
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.context["adminform"].form.errors)
            response = self.client.post(self.delete_url(target), {"post": "yes"})
            self.assertIn(response.status_code, (302, 403))
            target.refresh_from_db()
            self.assertTrue(target.is_active)

    def test_account_deletion_requires_csrf(self):
        secure_client = Client(enforce_csrf_checks=True)
        secure_client.force_login(self.admin)
        response = secure_client.post(self.delete_url(self.member), {"post": "yes"})
        self.assertEqual(response.status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.member.pk).exists())

    def test_stale_edit_preserves_credentials_and_roles_changed_by_another_operator(self):
        stale_member = User.objects.get(pk=self.member.pk)
        new_password = make_password("ConcurrentPassword123!")
        User.objects.filter(pk=self.member.pk).update(is_staff=True, is_superuser=True, password=new_password)
        stale_member.email = "updated-concurrently@example.com"
        request = RequestFactory().post(self.change_url(stale_member))
        request.user = self.admin
        admin.site._registry[User].save_model(request, stale_member, Mock(), change=True)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, "updated-concurrently@example.com")
        self.assertTrue(self.member.is_staff)
        self.assertTrue(self.member.is_superuser)
        self.assertEqual(self.member.password, new_password)
        self.assertTrue(self.member.check_password("ConcurrentPassword123!"))

    def test_stale_delete_cannot_remove_account_promoted_to_superuser(self):
        stale_member = User.objects.get(pk=self.member.pk)
        User.objects.filter(pk=self.member.pk).update(is_staff=True, is_superuser=True)
        request = RequestFactory().post(self.delete_url(stale_member), {"post": "yes"})
        request.user = self.admin
        with self.assertRaises(PermissionDenied):
            admin.site._registry[User].delete_model(request, stale_member)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_superuser)
        self.assertTrue(Profile.objects.filter(user=self.member).exists())

    @patch("progress.services.private_storage")
    def test_confirmed_deletion_cascades_records_and_retains_failed_photo_cleanup_jobs(self, storage):
        storage.return_value = Mock()
        storage.return_value.delete.side_effect = OSError("Storage unavailable")
        weight = WeeklyWeight.objects.create(user=self.member, week_start=date(2026, 10, 5),
                                            measured_on=date(2026, 10, 5), weight_kg="70")
        photo = ProgressPhoto.objects.create(weight=weight, file_key="photos/admin-delete.jpg",
                                            thumbnail_key="thumbnails/admin-delete.jpg", captured_on=date(2026, 10, 5), position=0)
        keys = {photo.file_key, photo.thumbnail_key}
        member_id = self.member.pk
        response = self.client.get(self.delete_url(self.member))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(pk=member_id).exists())
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.delete_url(self.member), {"post": "yes"})
        self.assertEqual(response.status_code, 302, response.content)
        self.assertFalse(User.objects.filter(pk=member_id).exists())
        self.assertFalse(Profile.objects.filter(user_id=member_id).exists())
        self.assertFalse(WeeklyWeight.objects.filter(pk=weight.pk).exists())
        self.assertFalse(ProgressPhoto.objects.filter(pk=photo.pk).exists())
        self.assertEqual(set(MediaDeletion.objects.values_list("key", flat=True)), keys)
        self.assertTrue(all(job.attempts == 1 for job in MediaDeletion.objects.all()))
        self.assertTrue(LogEntry.objects.filter(user=self.admin, object_id=str(member_id), action_flag=DELETION).exists())

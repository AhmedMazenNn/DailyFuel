"""Behavior and access-control checks for in-app account administration."""
from datetime import date
from unittest.mock import Mock, patch

from allauth.account.models import EmailAddress
from django.contrib.admin.models import CHANGE, DELETION, LogEntry
from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from progress.models import MediaDeletion, ProgressPhoto, WeeklyWeight
from .models import Profile, User


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AdminAccountApiTests(TestCase):
    root = "/api/v1/admin/users/"

    def setUp(self):
        self.admin = User.objects.create_superuser("admin@example.com", "StrongAdminPass123!")
        self.member = User.objects.create_user("member@example.com", "StrongMemberPass123!")
        Profile.objects.filter(user=self.member).update(display_name="Member")
        self.client = APIClient()
        self.client.force_login(self.admin)

    def url(self, user=None):
        return f"{self.root}{(user or self.member).pk}/"

    def detail(self, user=None):
        response = self.client.get(self.url(user))
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def edit(self, **changes):
        data = {"version": self.detail()["version"], **changes}
        return self.client.patch(self.url(), data, format="json")

    def test_anonymous_members_staff_and_inactive_admins_cannot_manage_any_accounts(self):
        staff = User.objects.create_user("staff@example.com", is_staff=True)
        staff.user_permissions.set(Permission.objects.filter(content_type__app_label="accounts"))
        inactive = User.objects.create_superuser("inactive@example.com", is_active=False)
        version = self.detail()["version"]
        for actor in (None, self.member, staff, inactive):
            client = APIClient()
            if actor:
                client.force_login(actor)
            for method, url, data in (
                ("get", self.root, None), ("get", self.url(), None),
                ("patch", self.url(), {"name": "Hijacked", "version": version}),
                ("delete", self.url(), {"confirmationEmail": self.member.email, "version": version}),
            ):
                kwargs = {"data": data, "format": "json"} if data is not None else {}
                response = getattr(client, method)(url, **kwargs)
                self.assertEqual(response.status_code, 403, (actor, method, response.content))
        self.member.refresh_from_db()
        self.assertEqual(self.member.profile.display_name, "Member")

    def test_list_search_filters_summary_and_pagination(self):
        User.objects.create_user("inactive@example.com", is_active=False)
        for index in range(26):
            User.objects.create_user(f"extra{index:02}@example.com")
        response = self.client.get(self.root)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["count"], 29)
        self.assertEqual(len(body["results"]), 25)
        self.assertEqual(body["page"], 1)
        self.assertEqual(body["pages"], 2)
        self.assertEqual(body["summary"], {"total": 29, "active": 28, "inactive": 1, "admins": 1})
        self.assertEqual(len(self.client.get(self.root, {"page": 2}).json()["results"]), 4)
        self.assertEqual(self.client.get(self.root, {"status": "admin"}).json()["count"], 1)
        self.assertEqual(self.client.get(self.root, {"status": "inactive"}).json()["count"], 1)
        self.assertEqual(self.client.get(self.root, {"status": "active"}).json()["count"], 28)
        result = self.client.get(self.root, {"search": "MEMBER"}).json()
        self.assertEqual([entry["id"] for entry in result["results"]], [str(self.member.pk)])
        self.assertEqual(self.client.get(self.root, {"page": 99}).json()["page"], 2)
        for params in ({"page": "abc"}, {"page": 0}, {"status": "unknown"}):
            self.assertEqual(self.client.get(self.root, params).status_code, 400, params)

    def test_detail_shows_metadata_counts_but_never_private_content_or_credentials(self):
        weight = WeeklyWeight.objects.create(user=self.member, week_start=date(2026, 10, 5),
                                            measured_on=date(2026, 10, 5), weight_kg="70")
        ProgressPhoto.objects.create(weight=weight, file_key="photos/private-original.jpg",
                                     thumbnail_key="thumbnails/private-thumb.jpg", captured_on=date(2026, 10, 5), position=0)
        body = self.detail()
        self.assertEqual(body["id"], str(self.member.pk))
        self.assertEqual(body["email"], self.member.email)
        self.assertEqual(body["activity"], {"meals": 0, "foods": 0, "weeks": 1, "photos": 1})
        self.assertFalse(body["isAdmin"])
        self.assertTrue(body["isActive"])
        self.assertTrue(body["version"])
        self.assertNotIn("private-original", str(body))
        self.assertNotIn("private-thumb", str(body))
        for key in ("password", "weight", "weightKg", "initialCalories", "fileKey"):
            self.assertNotIn(key, body)
        self.assertEqual(self.client.get(f"{self.root}999999999/").status_code, 404)

    def test_edit_normalizes_email_syncs_verification_and_preserves_password_and_roles(self):
        EmailAddress.objects.create(user=self.member, email=self.member.email, primary=True, verified=True)
        password = self.member.password
        response = self.edit(email=" UPDATED@EXAMPLE.COM ", name="Updated", timezone="Africa/Cairo",
                             language="ar", weightUnit="lb", isActive=False)
        self.assertEqual(response.status_code, 200, response.content)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, "updated@example.com")
        self.assertEqual(self.member.password, password)
        self.assertFalse(self.member.is_staff)
        self.assertFalse(self.member.is_superuser)
        self.assertFalse(self.member.is_active)
        profile = self.member.profile
        self.assertEqual((profile.display_name, profile.timezone, profile.locale, profile.weight_unit),
                         ("Updated", "Africa/Cairo", "ar", "lb"))
        self.assertFalse(EmailAddress.objects.filter(user=self.member, email="member@example.com").exists())
        address = EmailAddress.objects.get(user=self.member, email=self.member.email)
        self.assertTrue(address.primary)
        self.assertFalse(address.verified)
        entry = LogEntry.objects.get(user=self.admin, object_id=str(self.member.pk), action_flag=CHANGE)
        self.assertNotIn(password, entry.change_message)
        self.assertNotIn("StrongMemberPass", entry.change_message)
        self.assertTrue(response.json()["history"])

    def test_invalid_profile_and_duplicate_identity_roll_back_all_changes(self):
        EmailAddress.objects.create(user=self.admin, email="alias@example.com", verified=True)
        for data in ({"timezone": "Unknown/Nowhere", "name": "Invalid"},
                     {"email": self.admin.email.upper()}, {"email": "ALIAS@EXAMPLE.COM"},
                     {"language": "xx"}, {"weightUnit": "oz"}, {"isActive": "invalid"}):
            response = self.edit(**data)
            self.assertEqual(response.status_code, 400, response.content)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, "member@example.com")
        self.assertEqual(self.member.profile.display_name, "Member")
        self.assertFalse(LogEntry.objects.filter(object_id=str(self.member.pk)).exists())

    def test_sensitive_and_unknown_fields_and_missing_version_are_rejected(self):
        for field, value in (("isAdmin", True), ("is_superuser", True), ("is_staff", True),
                             ("password", "NewPassword123!"), ("unknownField", "value")):
            response = self.edit(**{field: value})
            self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(self.client.patch(self.url(), {"name": "Missing version"}, format="json").status_code, 400)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_superuser)
        self.assertTrue(self.member.check_password("StrongMemberPass123!"))

    def test_new_password_validates_atomically_changes_credentials_and_invalidates_member_session(self):
        member_client = APIClient()
        member_client.force_login(self.member)
        response = self.edit(email="should-not-save@example.com", newPassword="short")
        self.assertEqual(response.status_code, 400, response.content)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, "member@example.com")
        self.assertTrue(self.member.check_password("StrongMemberPass123!"))
        self.assertFalse(LogEntry.objects.filter(object_id=str(self.member.pk)).exists())
        response = self.edit(newPassword="DifferentMemberSecret983!")
        self.assertEqual(response.status_code, 200, response.content)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("DifferentMemberSecret983!"))
        session = member_client.get("/api/v1/auth/session/")
        self.assertFalse(session.json().get("user"))
        entry = LogEntry.objects.get(object_id=str(self.member.pk), action_flag=CHANGE)
        self.assertNotIn("DifferentMemberSecret983!", entry.change_message)
        self.assertNotIn("newPassword", response.json())

    def test_admin_password_change_preserves_current_session(self):
        version = self.detail(self.admin)["version"]
        response = self.client.patch(self.url(self.admin),
                                     {"version": version, "newPassword": "DifferentAdminSecret784!"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("DifferentAdminSecret784!"))
        self.assertEqual(self.client.get(self.root).status_code, 200)

    def test_concurrent_credential_change_invalidates_version(self):
        version = self.detail()["version"]
        self.member.set_password("ConcurrentNewSecret892!")
        self.member.save(update_fields=["password"])
        response = self.client.patch(self.url(), {"name": "Stale", "version": version}, format="json")
        self.assertEqual(response.status_code, 409, response.content)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("ConcurrentNewSecret892!"))
        self.assertEqual(self.member.profile.display_name, "Member")

    def test_stale_and_tampered_versions_cannot_overwrite_newer_edits(self):
        version = self.detail()["version"]
        self.assertEqual(self.edit(name="Latest").status_code, 200)
        count = LogEntry.objects.count()
        for token in (version, "not-a-valid-version"):
            response = self.client.patch(self.url(), {"name": "Stale", "version": token}, format="json")
            self.assertEqual(response.status_code, 409, response.content)
        self.member.refresh_from_db()
        self.assertEqual(self.member.profile.display_name, "Latest")
        self.assertEqual(LogEntry.objects.count(), count)
        response = self.client.delete(self.url(), {"confirmationEmail": self.member.email, "version": version}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(User.objects.filter(pk=self.member.pk).exists())

    def test_admin_accounts_cannot_be_deactivated_or_deleted(self):
        other = User.objects.create_superuser("other-admin@example.com")
        for target in (self.admin, other):
            version = self.detail(target)["version"]
            response = self.client.patch(self.url(target), {"isActive": False, "version": version}, format="json")
            self.assertIn(response.status_code, (400, 403))
            response = self.client.delete(self.url(target), {"confirmationEmail": target.email, "version": version}, format="json")
            self.assertIn(response.status_code, (400, 403))
            target.refresh_from_db()
            self.assertTrue(target.is_active)

    def test_mutations_require_session_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.admin)
        version = self.detail()["version"]
        for method, data in (("patch", {"name": "No CSRF", "version": version}),
                             ("delete", {"confirmationEmail": self.member.email, "version": version})):
            response = getattr(client, method)(self.url(), data, format="json")
            self.assertEqual(response.status_code, 403)
        csrf = client.get("/api/v1/auth/csrf/")
        self.assertEqual(csrf.status_code, 200)
        token = csrf.json()["csrfToken"]
        response = client.patch(self.url(), {"name": "With CSRF", "version": version}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200, response.content)

    def test_delete_requires_exact_confirmation_and_current_version(self):
        version = self.detail()["version"]
        for data in ({"version": version}, {"version": version, "confirmationEmail": "wrong@example.com"},
                     {"version": version, "confirmationEmail": self.member.email.upper()},
                     {"confirmationEmail": self.member.email}):
            response = self.client.delete(self.url(), data, format="json")
            self.assertEqual(response.status_code, 400, response.content)
        self.assertTrue(User.objects.filter(pk=self.member.pk).exists())

    @patch("progress.services.private_storage")
    def test_deletion_cascades_records_audits_and_keeps_failed_cleanup_jobs(self, storage):
        storage.return_value = Mock()
        storage.return_value.delete.side_effect = OSError("Storage unavailable")
        weight = WeeklyWeight.objects.create(user=self.member, week_start=date(2026, 10, 5),
                                            measured_on=date(2026, 10, 5), weight_kg="70")
        photo = ProgressPhoto.objects.create(weight=weight, file_key="photos/admin-api-delete.jpg",
                                            thumbnail_key="thumbnails/admin-api-delete.jpg", captured_on=date(2026, 10, 5), position=0)
        keys = {photo.file_key, photo.thumbnail_key}
        pk = self.member.pk
        version = self.detail()["version"]
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url(), {"version": version, "confirmationEmail": self.member.email}, format="json")
        self.assertEqual(response.status_code, 204, response.content)
        self.assertFalse(User.objects.filter(pk=pk).exists())
        self.assertFalse(Profile.objects.filter(user_id=pk).exists())
        self.assertFalse(WeeklyWeight.objects.filter(pk=weight.pk).exists())
        self.assertFalse(ProgressPhoto.objects.filter(pk=photo.pk).exists())
        self.assertEqual(set(MediaDeletion.objects.values_list("key", flat=True)), keys)
        self.assertTrue(all(job.attempts == 1 for job in MediaDeletion.objects.all()))
        self.assertTrue(LogEntry.objects.filter(user=self.admin, object_id=str(pk), action_flag=DELETION).exists())

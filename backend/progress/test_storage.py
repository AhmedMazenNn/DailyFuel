from io import BytesIO
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError, EndpointConnectionError
from django.core.exceptions import ImproperlyConfigured, SuspiciousFileOperation
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings
from django.core.management import call_command
from django.core.management.base import CommandError

from .storage import S3PrivateStorage, private_storage


def failure(code):
    return ClientError({"Error": {"Code": code}}, "storage")


@override_settings(PRIVATE_MEDIA_BACKEND="s3", S3_BUCKET_NAME="private-progress",
                   S3_ACCESS_KEY_ID="test-key", S3_SECRET_ACCESS_KEY="test-secret",
                   S3_ENDPOINT_URL="https://storage.example.test", S3_REGION_NAME="test-region")
class S3PrivateStorageTests(SimpleTestCase):
    def setUp(self):
        self.client_patch = patch("boto3.client")
        self.factory = self.client_patch.start()
        self.addCleanup(self.client_patch.stop)
        self.client = self.factory.return_value
        self.storage = private_storage()

    def test_explicit_server_credentials_and_private_urls(self):
        kwargs = self.factory.call_args.kwargs
        self.assertEqual(kwargs["aws_access_key_id"], "test-key")
        self.assertEqual(kwargs["endpoint_url"], "https://storage.example.test")
        self.assertEqual(kwargs["config"].signature_version, "s3v4")
        with self.assertRaises(ValueError):
            self.storage.url("photos/test.jpg")

    def test_save_retains_exact_key_and_private_cache_without_public_acl(self):
        self.client.head_object.side_effect = failure("NoSuchKey")
        self.assertEqual(self.storage.save("photos/test.jpg", ContentFile(b"image")), "photos/test.jpg")
        kwargs = self.client.put_object.call_args.kwargs
        self.assertEqual(kwargs["Key"], "photos/test.jpg")
        self.assertEqual(kwargs["CacheControl"], "private, no-store")
        self.assertNotIn("ACL", kwargs)

    def test_existing_key_is_refused_without_renaming_or_writing(self):
        with self.assertRaises(FileExistsError):
            self.storage.save("photos/test.jpg", ContentFile(b"image"))
        self.client.put_object.assert_not_called()

    def test_permissions_are_not_treated_as_absence_or_successful_delete(self):
        self.client.head_object.side_effect = failure("AccessDenied")
        with self.assertRaises(OSError):
            self.storage.save("photos/test.jpg", ContentFile(b"image"))
        self.client.put_object.assert_not_called()
        self.client.delete_object.side_effect = failure("AccessDenied")
        with self.assertRaises(OSError):
            self.storage.delete("photos/test.jpg")

    def test_get_is_seekable_and_closes_remote_body(self):
        body = BytesIO(b"private image")
        self.client.get_object.return_value = {"Body": body}
        with self.storage.open("photos/test.jpg", "rb") as image:
            self.assertEqual(image.read(), b"private image")
            image.seek(0)
            self.assertEqual(image.read(7), b"private")
        self.assertTrue(body.closed)
        self.client.get_object.assert_called_once_with(Bucket="private-progress", Key="photos/test.jpg")

    def test_missing_read_and_network_failure_are_distinct(self):
        self.client.get_object.side_effect = failure("NoSuchKey")
        with self.assertRaises(FileNotFoundError):
            self.storage.open("photos/test.jpg")
        self.client.get_object.side_effect = EndpointConnectionError(endpoint_url="secret")
        with self.assertRaisesRegex(OSError, "unavailable"):
            self.storage.open("photos/test.jpg")

    def test_stream_failure_closes_body(self):
        body = Mock()
        body.read.side_effect = OSError("sensitive details")
        self.client.get_object.return_value = {"Body": body}
        with self.assertRaisesRegex(OSError, "download failed"):
            self.storage.open("photos/test.jpg")
        body.close.assert_called_once()

    def test_invalid_keys_cannot_delete_other_objects(self):
        for key in ("../photos/image.jpg", "/photos/image.jpg", "public/image.jpg", "photos/../other", ""):
            with self.subTest(key=key), self.assertRaises(SuspiciousFileOperation):
                self.storage.delete(key)
        self.client.delete_object.assert_not_called()

    @override_settings(S3_SECRET_ACCESS_KEY="")
    def test_missing_credentials_fail_closed(self):
        with self.assertRaises(ImproperlyConfigured):
            S3PrivateStorage()

    @override_settings(PRIVATE_MEDIA_BACKEND="typo")
    def test_unknown_backend_fails_closed(self):
        with self.assertRaises(ImproperlyConfigured):
            private_storage()


class PrivateMediaMigrationTests(SimpleTestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for folder in ("photos", "thumbnails"):
            (self.root / folder).mkdir()
            (self.root / folder / "test.jpg").write_bytes(b"image")
        patcher = patch("progress.management.commands.migrate_private_media.S3PrivateStorage")
        self.remote = patcher.start().return_value
        self.addCleanup(patcher.stop)
        patcher = patch("progress.management.commands.migrate_private_media.ProgressPhoto")
        self.model = patcher.start()
        self.addCleanup(patcher.stop)
        self.model.objects.values_list.return_value.iterator.return_value = iter([
            ("photos/test.jpg", "thumbnails/test.jpg"),
        ])
        self.remote.exists.return_value = False
        self.remote.size.return_value = 5

    def run_command(self, **options):
        output = StringIO()
        call_command("migrate_private_media", source_dir=str(self.root), stdout=output, **options)
        return output.getvalue()

    def test_copies_tracked_files_and_retains_originals(self):
        output = self.run_command()
        self.assertEqual(self.remote.save.call_count, 2)
        self.assertIn("Copied 2 files", output)
        self.assertTrue((self.root / "photos/test.jpg").exists())

    def test_existing_matching_files_are_not_rewritten(self):
        self.remote.exists.return_value = True
        self.assertIn("verified 2 existing files", self.run_command())
        self.remote.save.assert_not_called()

    def test_dry_run_does_not_write(self):
        self.assertIn("Would copy 2 files", self.run_command(dry_run=True))
        self.remote.save.assert_not_called()

    def test_size_conflict_fails_without_overwrite(self):
        self.remote.exists.return_value = True
        self.remote.size.return_value = 99
        with self.assertRaisesRegex(CommandError, "differs in size"):
            self.run_command()
        self.remote.save.assert_not_called()

    def test_missing_local_file_fails_without_revealing_key(self):
        (self.root / "photos/test.jpg").unlink()
        with self.assertRaisesRegex(CommandError, "source file is missing"):
            self.run_command()
        self.remote.save.assert_not_called()

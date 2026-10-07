from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, SuspiciousFileOperation
from django.core.files.base import File
from django.core.files.storage import FileSystemStorage, Storage
from tempfile import SpooledTemporaryFile
from pathlib import PurePosixPath


class PrivateStorage(FileSystemStorage):
    def url(self, name):
        raise ValueError("Private media is only available through authorized views.")


class S3PrivateStorage(Storage):
    """Server-only object access. Provision the bucket with public reads disabled.

    Exact keys are required by the durable deletion queue. Never silently rename
    or replace an existing object. Callers generate fresh UUID keys; this adapter
    is not intended for competing writers to the same key.
    """

    def __init__(self):
        import boto3
        from botocore.config import Config

        required = ("S3_BUCKET_NAME", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY")
        if any(not getattr(settings, key, "") for key in required):
            raise ImproperlyConfigured("Private S3 storage credentials and bucket are required.")
        self.bucket = settings.S3_BUCKET_NAME
        self.client = boto3.client(
            "s3", endpoint_url=getattr(settings, "S3_ENDPOINT_URL", None) or None,
            region_name=getattr(settings, "S3_REGION_NAME", "us-east-1"),
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                          request_checksum_calculation="when_required",
                          response_checksum_validation="when_required"),
        )

    @staticmethod
    def _key(name):
        if (not name or "\\" in name or name.startswith("/")
                or ".." in PurePosixPath(name).parts
                or PurePosixPath(name).parts[0] not in {"photos", "thumbnails"}):
            raise SuspiciousFileOperation("Invalid private media key.")
        return name

    def _call(self, operation, name, **kwargs):
        from botocore.exceptions import BotoCoreError, ClientError

        try:
            return getattr(self.client, operation)(Bucket=self.bucket, Key=self._key(name), **kwargs)
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code in {"NoSuchKey", "NotFound", "404"}:
                raise FileNotFoundError("Private media was not found.") from None
            if code in {"PreconditionFailed", "ConditionalRequestConflict", "412", "409"}:
                raise FileExistsError("Private media key already exists.") from None
            raise OSError("Private media operation failed.") from None
        except BotoCoreError:
            raise OSError("Private media storage is unavailable.") from None

    def get_available_name(self, name, max_length=None):
        self._key(name)
        if max_length is not None and len(name) > max_length:
            raise SuspiciousFileOperation("Private media key exceeds the allowed length.")
        if self.exists(name):
            raise FileExistsError("Private media key already exists.")
        return name

    def _save(self, name, content):
        content.seek(0)
        self._call("put_object", name, Body=content, ContentType="image/jpeg",
                   CacheControl="private, no-store")
        return name

    def _open(self, name, mode="rb"):
        if mode not in {"r", "rb"}:
            raise ValueError("Private media may only be opened for reading.")
        response = self._call("get_object", name)
        body = response["Body"]
        # Seekable file supports Django FileResponse; larger images spill to disk.
        output = SpooledTemporaryFile(max_size=2 * 1024 * 1024)
        try:
            while chunk := body.read(64 * 1024):
                output.write(chunk)
            output.seek(0)
            return File(output, name=name)
        except Exception:
            output.close()
            raise OSError("Private media download failed.") from None
        finally:
            body.close()

    def exists(self, name):
        try:
            self._call("head_object", name)
        except FileNotFoundError:
            return False
        return True

    def size(self, name):
        return self._call("head_object", name)["ContentLength"]

    def delete(self, name):
        self._call("delete_object", name)

    def url(self, name):
        raise ValueError("Private media is only available through authorized views.")


def private_storage():
    backend = getattr(settings, "PRIVATE_MEDIA_BACKEND", "local")
    if backend == "s3":
        return S3PrivateStorage()
    if backend != "local":
        raise ImproperlyConfigured("Unknown private media storage backend.")
    return PrivateStorage(location=settings.PRIVATE_MEDIA_ROOT)

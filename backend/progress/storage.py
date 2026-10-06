from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateStorage(FileSystemStorage):
    def url(self, name):
        raise ValueError("Private media is only available through authorized views.")


def private_storage():
    return PrivateStorage(location=settings.PRIVATE_MEDIA_ROOT)

from datetime import timedelta
from io import BytesIO
import logging
import uuid
import warnings
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError
from .models import MediaDeletion, ProgressPhoto, WeeklyWeight
from .storage import private_storage

logger = logging.getLogger(__name__)


def clean_image(upload):
    if upload.size > settings.PHOTO_MAX_BYTES:
        raise ValidationError({"image": "Image exceeds the configured upload limit."})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(upload)
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValidationError({"image": "Choose a JPEG, PNG, or WebP image."})
            if image.width * image.height > 25_000_000:
                raise ValidationError({"image": "Image dimensions are too large (maximum 25 megapixels)."})
            image.verify()
            upload.seek(0)
            image = ImageOps.exif_transpose(Image.open(upload))
            image.load()
            if image.mode in ("RGBA", "LA") or "transparency" in image.info:
                rgba = image.convert("RGBA")
                background = Image.new("RGB", image.size, "white")
                background.paste(rgba, mask=rgba.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")
            # Re-encoding strips EXIF/GPS and untrusted trailing data.
            image.thumbnail((2560, 2560))
            original = BytesIO()
            image.save(original, "JPEG", quality=90, optimize=True)
            image.thumbnail((480, 480))
            thumbnail = BytesIO()
            image.save(thumbnail, "JPEG", quality=82, optimize=True)
            return original.getvalue(), thumbnail.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError({"image": "The file is not a valid supported image."})


def process_deletions(limit=100):
    completed = 0
    ids = list(MediaDeletion.objects.filter(ready_at__lte=timezone.now()).order_by("pk").values_list("pk", flat=True)[:limit])
    for job_id in ids:
        with transaction.atomic():
            job = MediaDeletion.objects.select_for_update(skip_locked=True).filter(pk=job_id).first()
            if job is None:
                continue
            if ProgressPhoto.objects.filter(Q(file_key=job.key) | Q(thumbnail_key=job.key)).exists():
                # A successful upload may have crashed before removing its safety job.
                job.delete()
                continue
            try:
                private_storage().delete(job.key)
            except OSError:
                job.attempts += 1
                job.ready_at = timezone.now() + timedelta(minutes=min(60, 2 ** min(job.attempts, 6)))
                job.save(update_fields=["attempts", "ready_at"])
                logger.warning("Private media cleanup will retry", extra={"job_id": job.pk})
            else:
                job.delete()
                completed += 1
    return completed


def _cleanup_after_commit():
    # Persisted jobs are retried by the management command if immediate cleanup fails.
    try:
        process_deletions()
    except Exception:
        logger.warning("Private media cleanup deferred to worker")


def upload_photo(user, week, values):
    image, thumbnail = clean_image(values["image"])
    photo_id = uuid.uuid4()
    keys = [f"photos/{photo_id}.jpg", f"thumbnails/{photo_id}.jpg"]
    # Committed before filesystem writes: crash/rollback cannot orphan these files.
    jobs = [MediaDeletion.objects.create(key=key, ready_at=timezone.now() + timedelta(hours=1)) for key in keys]
    try:
        with transaction.atomic():
            get_object_or_404(get_user_model().objects.select_for_update(), pk=user.pk)
            weight = WeeklyWeight.objects.select_for_update().filter(user=user, week_start=week).first()
            if weight is None:
                raise ValidationError({"weightKg": "Save this week's weight before uploading a photo."})
            occupied = set(weight.photos.values_list("position", flat=True))
            if len(occupied) >= 4:
                raise ValidationError({"image": "This week already has four photos. Delete one to add another."})
            storage = private_storage()
            storage.save(keys[0], ContentFile(image))
            storage.save(keys[1], ContentFile(thumbnail))
            photo = ProgressPhoto.objects.create(
                id=photo_id, weight=weight, file_key=keys[0], thumbnail_key=keys[1],
                position=next(position for position in range(4) if position not in occupied),
                captured_on=values["capturedOn"], label=values.get("label", ""), note=values.get("note", ""),
            )
            transaction.on_commit(lambda: MediaDeletion.objects.filter(pk__in=[job.pk for job in jobs]).delete())
            return photo
    except Exception:
        MediaDeletion.objects.filter(pk__in=[job.pk for job in jobs]).update(ready_at=timezone.now())
        _cleanup_after_commit()
        raise


def _queue_photo(photo):
    for key in (photo.file_key, photo.thumbnail_key):
        MediaDeletion.objects.update_or_create(key=key, defaults={"ready_at": timezone.now()})


@transaction.atomic
def delete_photo(user, photo_id):
    get_object_or_404(get_user_model().objects.select_for_update(), pk=user.pk)
    photo = get_object_or_404(ProgressPhoto.objects.select_for_update(), pk=photo_id, weight__user=user)
    _queue_photo(photo)
    photo.delete()
    transaction.on_commit(_cleanup_after_commit)


@transaction.atomic
def delete_account(user):
    locked = get_object_or_404(get_user_model().objects.select_for_update(), pk=user.pk)
    photos = ProgressPhoto.objects.filter(weight__user=locked)
    for photo in photos:
        _queue_photo(photo)
    photos.delete()
    locked.delete()
    transaction.on_commit(_cleanup_after_commit)

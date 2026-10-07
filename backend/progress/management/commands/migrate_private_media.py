from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from progress.models import ProgressPhoto
from progress.storage import PrivateStorage, S3PrivateStorage


class Command(BaseCommand):
    help = "Copy database-referenced local photos to private S3 without deleting originals."

    def add_arguments(self, parser):
        parser.add_argument("--source-dir", required=True)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        root = Path(options["source_dir"]).resolve()
        if not root.is_dir():
            raise CommandError("The source directory must exist.")
        source = PrivateStorage(location=root)
        destination = S3PrivateStorage()
        copied = verified = 0
        try:
            rows = ProgressPhoto.objects.values_list("file_key", "thumbnail_key").iterator()
            for keys in rows:
                for key in keys:
                    destination._key(key)
                    # Refuse symlinks escaping the source tree as well as traversal.
                    if not Path(source.path(key)).resolve().is_relative_to(root):
                        raise CommandError("A referenced source file is outside the source directory.")
                    if not source.exists(key):
                        raise CommandError("A referenced source file is missing; originals were retained.")
                    expected_size = source.size(key)
                    if destination.exists(key):
                        if destination.size(key) != expected_size:
                            raise CommandError("An existing remote file differs in size; nothing was overwritten.")
                        verified += 1
                        continue
                    if options["dry_run"]:
                        copied += 1
                        continue
                    with source.open(key, "rb") as image:
                        destination.save(key, image)
                    if destination.size(key) != expected_size:
                        raise CommandError("A copied file failed size verification; originals were retained.")
                    copied += 1
        except CommandError:
            raise
        except Exception:
            # Neither keys nor upstream exceptions containing credentials go to logs.
            raise CommandError("Private media migration failed; local originals were retained.") from None
        action = "Would copy" if options["dry_run"] else "Copied"
        self.stdout.write(self.style.SUCCESS(f"{action} {copied} files; verified {verified} existing files. Local originals retained."))

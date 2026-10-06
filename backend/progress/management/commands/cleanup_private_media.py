from django.core.management.base import BaseCommand
from progress.services import process_deletions


class Command(BaseCommand):
    help = "Retry durable private-media cleanup jobs (schedule this command every minute)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        count = process_deletions(limit=options["limit"])
        self.stdout.write(f"Removed {count} private-media objects.")

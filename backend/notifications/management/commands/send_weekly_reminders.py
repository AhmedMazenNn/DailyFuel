import json
from django.core.management.base import BaseCommand, CommandError
from notifications.worker import run_reminders


class Command(BaseCommand):
    help = "Process opted-in, confirmed weekly email reminders; logs aggregate counts only."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Inspect due work without writing records or sending email.")
        parser.add_argument("--limit", type=int, default=25)

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 50:
            raise CommandError("Limit must be between 1 and 50.")
        try:
            result = run_reminders(limit=options["limit"], dry_run=options["dry_run"])
        except Exception:
            raise CommandError("Weekly reminder processing failed; inspect configuration and database availability.") from None
        self.stdout.write(json.dumps(result, sort_keys=True))
        if result.get("disabled") and not options["dry_run"]:
            raise CommandError("Weekly email delivery is disabled.")
        if result["unknown"] or result["rejected"]:
            raise CommandError("Some email attempts failed or were uncertain. Check provider status; uncertain attempts are not retried.")

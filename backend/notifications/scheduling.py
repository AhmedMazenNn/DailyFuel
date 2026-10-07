from datetime import datetime, timedelta, timezone as utc_timezone
from zoneinfo import ZoneInfo


def next_due(now, zone, weekday, local_time):
    local = now.astimezone(ZoneInfo(zone))
    day = local.date() + timedelta(days=(weekday - local.weekday()) % 7)
    candidate = datetime.combine(day, local_time, tzinfo=ZoneInfo(zone))
    # UTC round trip moves nonexistent DST times forward; fold=0 picks the first
    # occurrence of an ambiguous time. The weekly ledger prevents a second send.
    candidate = candidate.astimezone(utc_timezone.utc)
    if candidate <= now:
        candidate = datetime.combine(day + timedelta(days=7), local_time, tzinfo=ZoneInfo(zone)).astimezone(utc_timezone.utc)
    return candidate


def local_week(now, zone):
    today = now.astimezone(ZoneInfo(zone)).date()
    return today - timedelta(days=today.weekday())

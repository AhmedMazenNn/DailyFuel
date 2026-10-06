from zoneinfo import ZoneInfo
from django.utils import timezone
from .models import Profile

def get_profile(user):
    return Profile.objects.get_or_create(user=user)[0]

def local_today(user):
    return timezone.now().astimezone(ZoneInfo(get_profile(user).timezone)).date()

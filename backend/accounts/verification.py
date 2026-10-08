"""Mailbox ownership verification using allauth's expiring confirmation keys."""
import logging
from urllib.parse import urlencode

from allauth.account.models import EmailAddress, EmailConfirmationHMAC
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.views.decorators.csrf import csrf_protect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response


def email_verified(user):
    return EmailAddress.objects.filter(user=user, email__iexact=user.email, verified=True).exists()


def send_verification(user):
    address, _ = EmailAddress.objects.get_or_create(user=user, email=user.email, defaults={"primary": True})
    if address.verified:
        return True
    if not cache.add(f"email-verification:{user.pk}", True, 60):
        return False
    token = EmailConfirmationHMAC(address).key
    link = f"{settings.FRONTEND_URL}/?{urlencode({'verify_email': token, 'lang': user.profile.locale})}"
    ar = user.profile.locale == "ar"
    subject = "تأكيد بريد DailyFuel" if ar else "Verify your DailyFuel email"
    body = f"أكد بريدك الإلكتروني: {link}" if ar else f"Confirm your email address: {link}\n\nIf you did not request this, ignore this email."
    try:
        return send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email]) == 1
    except Exception:
        logging.getLogger(__name__).warning("Verification email delivery failed")
        return False


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend(request):
    if send_verification(request.user):
        return Response({"detail": "Verification email sent. Check your inbox."})
    return Response({"detail": "Unable to send now. Please wait one minute and try again."}, status=429)


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def verify(request):
    confirmation = EmailConfirmationHMAC.from_key(str(request.data.get("token", "")))
    if confirmation:
        address = confirmation.email_address
        if address.user.is_active and address.email.lower() == address.user.email.lower():
            if confirmation.confirm(request._request):
                return Response({"detail": "Email verified."})
    return Response({"detail": "Invalid or expired verification link. Request a new email."}, status=400)

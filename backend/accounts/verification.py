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
from .email_templates import render_action_email


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
    intro = "أكد بريدك الإلكتروني في DailyFuel باستخدام الزر أدناه." if ar else "Confirm your DailyFuel email address using the button below."
    note = "إذا لم تطلب إنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة." if ar else "If you did not create this account, you can ignore this email."
    label = "تأكيد البريد الإلكتروني" if ar else "Verify email address"
    body = f"{intro}\n\n{label}: {link}\n\n{note}"
    html = render_action_email(locale=user.profile.locale, subject=subject, body=intro,
                               action_label=label, action_url=link, note=note)
    try:
        return send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], html_message=html) == 1
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

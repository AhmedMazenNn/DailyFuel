from rest_framework.permissions import BasePermission

from allauth.account.models import EmailAddress


class IsVerifiedEmail(BasePermission):
    message = "Verify your email address before using DailyFuel."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        return EmailAddress.objects.filter(user=user, email__iexact=user.email, verified=True).exists()

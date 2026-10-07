import json
from django.contrib.admin.models import CHANGE, DELETION, LogEntry
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.crypto import constant_time_compare, salted_hmac
from allauth.account.models import EmailAddress
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from nutrition.models import Meal, SavedFood
from progress.models import ProgressPhoto, WeeklyWeight
from progress.services import delete_account
from .administration import sync_account_email
from .models import Profile, User


class IsAccountAdministrator(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return user.is_authenticated and user.is_active and user.is_superuser


class StaleAccount(APIException):
    status_code = 409
    default_detail = "This account changed. Reload its details before saving or deleting."


def account_version(user):
    profile = user.profile
    values = [user.email, user.is_active, user.is_staff, user.is_superuser, user.password,
              profile.display_name, profile.timezone, profile.locale, profile.weight_unit,
              profile.updated_at.isoformat()]
    return salted_hmac("dailyfuel.account-admin.version", json.dumps(values), algorithm="sha256").hexdigest()


def account_payload(user, detail=False):
    profile = user.profile
    value = {"id": str(user.pk), "email": user.email, "name": profile.display_name,
             "isActive": user.is_active, "isAdmin": user.is_superuser,
             "joinedAt": user.date_joined.isoformat(),
             "lastLogin": user.last_login.isoformat() if user.last_login else None,
             "timezone": profile.timezone, "language": profile.locale, "weightUnit": profile.weight_unit,
             "version": account_version(user)}
    if detail:
        value["activity"] = {"meals": Meal.objects.filter(nutrition_day__user=user).count(),
                             "foods": SavedFood.objects.filter(user=user).count(),
                             "weeks": WeeklyWeight.objects.filter(user=user).count(),
                             "photos": ProgressPhoto.objects.filter(weight__user=user).count()}
        history = LogEntry.objects.filter(content_type=ContentType.objects.get_for_model(User),
                                          object_id=str(user.pk)).select_related("user").order_by("-action_time", "-pk")[:20]
        value["history"] = [{"id": entry.pk, "action": "delete" if entry.action_flag == DELETION else "update",
                             "at": entry.action_time.isoformat(), "actor": entry.user.email,
                             "description": entry.get_change_message()} for entry in history]
    return value


class ListOptions(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=100, default="")
    status = serializers.ChoiceField(choices=("all", "active", "inactive", "admin"), default="all")
    page = serializers.IntegerField(min_value=1, max_value=1000000, default=1)


class AccountUpdate(serializers.Serializer):
    version = serializers.CharField(max_length=64)
    email = serializers.EmailField(required=False, max_length=254)
    name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    isActive = serializers.BooleanField(required=False)
    timezone = serializers.CharField(required=False, max_length=64)
    language = serializers.ChoiceField(required=False, choices=("en", "ar"))
    weightUnit = serializers.ChoiceField(required=False, choices=("kg", "lb"))
    newPassword = serializers.CharField(required=False, min_length=10, max_length=128, trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise ValidationError("Unsupported account fields.")
        return attrs


class AccountDelete(serializers.Serializer):
    version = serializers.CharField(max_length=64)
    confirmationEmail = serializers.CharField(max_length=254, trim_whitespace=False)


def audit(actor, user, action, fields=None):
    message = [{"changed": {"fields": fields}}] if fields else "Deleted account through DailyFuel admin panel."
    LogEntry.objects.log_actions(user_id=actor.pk, queryset=[user], action_flag=action, change_message=message)


@api_view(["GET"])
@permission_classes([IsAccountAdministrator])
def users(request):
    options = ListOptions(data=request.query_params)
    options.is_valid(raise_exception=True)
    values = options.validated_data
    all_users = User.objects.all()
    summary = all_users.aggregate(total=Count("pk"), active=Count("pk", filter=Q(is_active=True)),
                                  inactive=Count("pk", filter=Q(is_active=False)),
                                  admins=Count("pk", filter=Q(is_superuser=True)))
    queryset = all_users.select_related("profile").order_by("-date_joined", "-pk")
    if values["search"]:
        queryset = queryset.filter(Q(email__icontains=values["search"]) | Q(profile__display_name__icontains=values["search"]))
    if values["status"] in ("active", "inactive"):
        queryset = queryset.filter(is_active=values["status"] == "active")
    elif values["status"] == "admin":
        queryset = queryset.filter(is_superuser=True)
    paginator = Paginator(queryset, 25)
    page = paginator.get_page(values["page"])
    return Response({"results": [account_payload(user) for user in page], "count": paginator.count,
                     "page": page.number, "pages": paginator.num_pages, "summary": summary})


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAccountAdministrator])
def user_detail(request, user_id):
    if request.method == "GET":
        return Response(account_payload(get_object_or_404(User.objects.select_related("profile"), pk=user_id), detail=True))
    serializer = (AccountUpdate if request.method == "PATCH" else AccountDelete)(data=request.data)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    try:
        with transaction.atomic():
            user = get_object_or_404(User.objects.select_for_update(), pk=user_id)
            user.profile = Profile.objects.select_for_update().get(user=user)
            if not constant_time_compare(values["version"], account_version(user)):
                raise StaleAccount
            if request.method == "DELETE":
                if user.is_superuser or user.pk == request.user.pk:
                    raise ValidationError("Administrator accounts cannot be deleted here.")
                if values["confirmationEmail"] != user.email:
                    raise ValidationError({"confirmationEmail": "Enter the account's exact email to confirm deletion."})
                audit(request.user, user, DELETION)
                delete_account(user)
                return Response(status=204)
            if not values.get("isActive", user.is_active) and (user.is_superuser or user.pk == request.user.pk):
                raise ValidationError({"isActive": "Administrator accounts cannot be deactivated here."})
            previous_email = user.email
            fields = []
            email = values.get("email", user.email).strip().lower()
            if (User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
                    or EmailAddress.objects.filter(email__iexact=email).exclude(user=user).exists()):
                raise ValidationError({"email": "This email belongs to another account."})
            for key, field in (("email", "email"), ("isActive", "is_active")):
                value = email if key == "email" else values.get(key, user.is_active)
                if getattr(user, field) != value:
                    setattr(user, field, value)
                    fields.append(key)
            for key, field in (("name", "display_name"), ("timezone", "timezone"), ("language", "locale"), ("weightUnit", "weight_unit")):
                if key in values and getattr(user.profile, field) != values[key]:
                    setattr(user.profile, field, values[key])
                    fields.append(key)
            try:
                user.profile.full_clean()
                if "newPassword" in values:
                    validate_password(values["newPassword"], user)
                    user.set_password(values["newPassword"])
                    fields.append("password")
            except DjangoValidationError as error:
                raise ValidationError(getattr(error, "message_dict", {"detail": error.messages})) from None
            if fields:
                user.save(update_fields=["email", "is_active"] + (["password"] if "password" in fields else []))
                if any(key in fields for key in ("name", "timezone", "language", "weightUnit")):
                    user.profile.save()
                sync_account_email(user, previous_email)
                audit(request.user, user, CHANGE, fields)
                if user.pk == request.user.pk and "password" in fields:
                    update_session_auth_hash(request._request, user)
            return Response(account_payload(user, detail=True))
    except IntegrityError:
        raise ValidationError({"email": "This email belongs to another account."}) from None

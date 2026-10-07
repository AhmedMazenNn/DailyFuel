from django.core.exceptions import ValidationError as DjangoValidationError
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from accounts.models import validate_timezone
from .models import ReminderPreference
from .preferences import preference_payload, request_confirmation, token_action, update_preference


class PreferenceInput(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    weekday = serializers.IntegerField(required=False, min_value=0, max_value=6)
    time = serializers.TimeField(required=False, input_formats=["%H:%M"])
    includePhotos = serializers.BooleanField(required=False)
    timezone = serializers.CharField(required=False, max_length=64)

    def validate_timezone(self, value):
        try:
            validate_timezone(value)
        except DjangoValidationError:
            raise ValidationError("Enter a valid IANA timezone.") from None
        return value

    def validate(self, attrs):
        if set(self.initial_data) - set(self.fields):
            raise ValidationError("Unsupported reminder settings.")
        return attrs


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def preferences(request):
    if request.method == "PATCH":
        payload = PreferenceInput(data=request.data)
        payload.is_valid(raise_exception=True)
        preference = update_preference(request.user, payload.validated_data)
    else:
        preference, _ = ReminderPreference.objects.get_or_create(user=request.user)
    return Response(preference_payload(preference))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirmation(request):
    return Response(preference_payload(request_confirmation(request.user)))


class TokenInput(serializers.Serializer):
    token = serializers.CharField(max_length=2048, trim_whitespace=False)


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def confirm(request):
    payload = TokenInput(data=request.data)
    payload.is_valid(raise_exception=True)
    token_action(payload.validated_data["token"], "confirm")
    return Response({"confirmed": True})


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def unsubscribe(request):
    payload = TokenInput(data=request.data)
    payload.is_valid(raise_exception=True)
    token_action(payload.validated_data["token"], "unsubscribe")
    return Response({"unsubscribed": True})

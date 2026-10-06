from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Profile, User

def _profile(p):
    return {"name": p.display_name, "email": p.user.email, "language": p.locale, "weightUnit": p.weight_unit,
            "textSize": p.text_size, "reduceMotion": p.reduce_motion, "showRewards": p.show_rewards,
            "timezone": p.timezone, "onboardingComplete": p.onboarding_complete,
            "initialTargets": {"calories": float(p.initial_calories), "protein": float(p.initial_protein), "fat": float(p.initial_fat)}}

def _session_payload(user):
    return {"user": {"id": str(user.pk), "email": user.email}, "profile": _profile(user.profile)}

@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request): return Response({"csrfToken": get_token(request)})

@api_view(["GET"])
@permission_classes([AllowAny])
def session(request):
    if not request.user.is_authenticated: return Response({"user": None, "profile": None})
    return Response(_session_payload(request.user))

def credentials(data):
    return str(data.get("email", "")).strip().lower(), str(data.get("password", ""))

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    email, password = credentials(request.data)
    if len(password) < 10: return Response({"password": ["Use at least 10 characters."]}, status=400)
    if User.objects.filter(email__iexact=email).exists(): return Response({"email": ["An account already exists."]}, status=400)
    user = User.objects.create_user(email=email, password=password)
    user.profile.display_name = str(request.data.get("name", ""))[:100]; user.profile.save()
    login(request._request, user, backend="django.contrib.auth.backends.ModelBackend")
    return Response(_session_payload(user))

@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email, password = credentials(request.data)
    user = authenticate(request, email=email, password=password)
    if not user: return Response({"detail": "Invalid email or password."}, status=400)
    login(request._request, user, backend="django.contrib.auth.backends.ModelBackend"); return Response(_session_payload(user))

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request._request); return Response(status=204)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    p = request.user.profile; mapping = {"name":"display_name", "language":"locale", "weightUnit":"weight_unit", "textSize":"text_size", "reduceMotion":"reduce_motion", "showRewards":"show_rewards", "timezone":"timezone", "onboardingComplete":"onboarding_complete"}
    for key, field in mapping.items():
        if key in request.data: setattr(p, field, request.data[key])
    targets = request.data.get("initialTargets") or {}
    for key, field in (("calories","initial_calories"),("protein","initial_protein"),("fat","initial_fat")):
        if key in targets: setattr(p, field, targets[key])
    try: p.full_clean(); p.save()
    except Exception as exc: return Response({"detail": str(exc)}, status=400)
    return Response(_profile(p))

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from accounts.views import csrf, session, register, login_view, logout_view, profile, auth_config, password_reset, password_reset_confirm
from accounts.google import google_login, google_callback
urlpatterns = [path("accounts/google/login/", google_login, name="google_login"), path("accounts/google/login/callback/", google_callback, name="google_callback"), path("admin/", admin.site.urls), path("accounts/", include("allauth.urls")), path("api/v1/health/", lambda request: JsonResponse({"status": "ok"})),
    path("api/v1/auth/csrf/", csrf), path("api/v1/auth/session/", session), path("api/v1/auth/config/", auth_config), path("api/v1/auth/register/", register), path("api/v1/auth/login/", login_view), path("api/v1/auth/logout/", logout_view), path("api/v1/auth/password/reset/", password_reset), path("api/v1/auth/password/reset/confirm/", password_reset_confirm), path("api/v1/profile/", profile),
    path("api/v1/", include("nutrition.urls")), path("api/v1/", include("progress.urls"))]

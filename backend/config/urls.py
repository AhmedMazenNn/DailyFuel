from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from accounts.views import csrf, session, register, login_view, logout_view, profile
urlpatterns = [path("admin/", admin.site.urls), path("accounts/", include("allauth.urls")), path("api/v1/health/", lambda request: JsonResponse({"status": "ok"})),
    path("api/v1/auth/csrf/", csrf), path("api/v1/auth/session/", session), path("api/v1/auth/register/", register), path("api/v1/auth/login/", login_view), path("api/v1/auth/logout/", logout_view), path("api/v1/profile/", profile),
    path("api/v1/", include("nutrition.urls")), path("api/v1/", include("progress.urls"))]

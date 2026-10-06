from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
urlpatterns = [path("admin/", admin.site.urls), path("accounts/", include("allauth.urls")), path("api/v1/health/", lambda request: JsonResponse({"status": "ok"}))]

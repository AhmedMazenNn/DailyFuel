from django.http import JsonResponse
from django.utils.cache import patch_vary_headers


class PrivateResponseMiddleware:
    """Prevent personalized API and authentication responses entering shared caches."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith(("/api/", "/accounts/", "/admin/")):
            response["Cache-Control"] = "private, no-store"
            patch_vary_headers(response, ("Cookie",))
        return response


def csrf_failure(request, reason=""):
    return JsonResponse({"detail": "Security token expired or missing. Refresh and try again."}, status=403)

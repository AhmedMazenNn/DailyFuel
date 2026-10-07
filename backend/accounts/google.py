"""Keep OAuth callbacks on the frontend that owns the session cookie."""
from django.conf import settings
from django.urls import reverse
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.views import OAuth2CallbackView, OAuth2LoginView


class FrontendGoogleAdapter(GoogleOAuth2Adapter):
    def get_callback_url(self, request, app):
        return settings.FRONTEND_URL + reverse("google_callback")


google_login = OAuth2LoginView.adapter_view(FrontendGoogleAdapter)
google_callback = OAuth2CallbackView.adapter_view(FrontendGoogleAdapter)

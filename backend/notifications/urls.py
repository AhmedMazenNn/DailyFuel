from django.urls import path
from . import views

urlpatterns = [path("email-reminders/", views.preferences),
               path("email-reminders/confirmation/", views.confirmation),
               path("email-reminders/confirm/", views.confirm),
               path("email-reminders/unsubscribe/", views.unsubscribe)]

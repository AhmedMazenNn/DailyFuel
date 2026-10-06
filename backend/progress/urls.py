from django.urls import path
from .views import WeeksView, WeekView, WeightView

urlpatterns = [
    path("progress/weeks/", WeeksView.as_view()),
    path("progress/weeks/<str:week_start>/", WeekView.as_view()),
    path("progress/weeks/<str:week_start>/weight/", WeightView.as_view()),
]

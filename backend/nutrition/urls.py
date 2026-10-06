from django.urls import path
from .views import (DayView, GamificationView, HistoryView, ItemOrderView, ItemsView,
                    ItemView, MealOrderView, MealsView, MealView)

urlpatterns = [
    path("nutrition-days/<str:date>/", DayView.as_view()),
    path("nutrition-days/<str:date>/meals/", MealsView.as_view()),
    path("nutrition-days/<str:date>/meals/reorder/", MealOrderView.as_view()),
    path("meals/<uuid:pk>/", MealView.as_view()),
    path("meals/<uuid:pk>/items/", ItemsView.as_view()),
    path("meals/<uuid:pk>/items/reorder/", ItemOrderView.as_view()),
    path("meal-items/<uuid:pk>/", ItemView.as_view()),
    path("history/", HistoryView.as_view()),
    path("gamification/", GamificationView.as_view()),
]

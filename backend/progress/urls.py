from django.urls import path
from .views import WeeksView, WeekView, WeightView

urlpatterns = [
    path("progress/weeks/", WeeksView.as_view()),
    path("progress/weeks/<str:week_start>/", WeekView.as_view()),
    path("progress/weeks/<str:week_start>/weight/", WeightView.as_view()),
]

from .views import PhotosView, PhotoView, PhotoFileView
urlpatterns += [
    path("progress/weeks/<str:week_start>/photos/", PhotosView.as_view()),
    path("progress/photos/<uuid:photo_id>/", PhotoView.as_view()),
    path("progress/photos/<uuid:photo_id>/file/", PhotoFileView.as_view()),
    path("progress/photos/<uuid:photo_id>/thumbnail/", PhotoFileView.as_view(), {"thumbnail": True}),
]

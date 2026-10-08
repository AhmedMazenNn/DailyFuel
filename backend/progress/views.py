from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsVerifiedEmail
from accounts.services import local_today
from .models import WeeklyWeight
from .serializers import WeightInput, parse_week, serialize_week


class WeekPagination(PageNumberPagination):
    page_size = 26


class WeeksView(APIView):
    permission_classes = [IsVerifiedEmail]
    def get(self, request):
        paginator = WeekPagination()
        records = WeeklyWeight.objects.filter(user=request.user).prefetch_related("photos")
        page = paginator.paginate_queryset(records, request)
        return paginator.get_paginated_response([serialize_week(row) for row in page])


class WeekView(APIView):
    permission_classes = [IsVerifiedEmail]
    def get(self, request, week_start):
        week = parse_week(week_start)
        record = WeeklyWeight.objects.filter(user=request.user, week_start=week).first()
        return Response(serialize_week(record, week))


class WeightView(WeekView):
    @transaction.atomic
    def put(self, request, week_start):
        week = parse_week(week_start)
        payload = WeightInput(data=request.data, context={"week": week})
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        # Lock the owner so concurrent first writes serialize even without a week row.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        record = WeeklyWeight.objects.filter(user=request.user, week_start=week).first()
        today = local_today(request.user)
        measured = today if today >= week and (today - week).days < 7 else week
        record, _ = WeeklyWeight.objects.update_or_create(
            user=request.user, week_start=week,
            defaults={
                "weight_kg": values["weightKg"],
                "measured_on": values.get("measuredOn", record.measured_on if record else measured),
                "note": values.get("note", record.note if record else ""),
            },
        )
        return Response(serialize_week(record))


from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils.cache import patch_vary_headers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from .models import ProgressPhoto
from .serializers import PhotoInput, serialize_photo
from .services import delete_photo, upload_photo
from .storage import private_storage


class PhotosView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, week_start):
        week = parse_week(week_start)
        photos = ProgressPhoto.objects.filter(weight__user=request.user, weight__week_start=week)
        return Response([serialize_photo(photo) for photo in photos])

    def post(self, request, week_start):
        week = parse_week(week_start)
        today = local_today(request.user)
        default = today if 0 <= (today - week).days < 7 else week
        payload = PhotoInput(data=request.data, context={"week": week, "default_date": default})
        payload.is_valid(raise_exception=True)
        photo = upload_photo(request.user, week, payload.validated_data)
        return Response(serialize_photo(photo), status=201)


class PhotoView(APIView):
    parser_classes = [JSONParser]

    @transaction.atomic
    def patch(self, request, photo_id):
        get_object_or_404(get_user_model().objects.select_for_update(), pk=request.user.pk)
        photo = get_object_or_404(ProgressPhoto.objects.select_related("weight"), pk=photo_id, weight__user=request.user)
        payload = PhotoInput(data=request.data, partial=True, context={"week": photo.weight.week_start, "default_date": photo.captured_on})
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        photo.label = values.get("label", photo.label)
        photo.note = values.get("note", photo.note)
        photo.captured_on = values["capturedOn"]
        photo.save(update_fields=["label", "note", "captured_on", "updated_at"])
        return Response(serialize_photo(photo))

    def delete(self, request, photo_id):
        delete_photo(request.user, photo_id)
        return Response(status=204)


class PhotoFileView(APIView):
    def get(self, request, photo_id, thumbnail=False):
        photo = get_object_or_404(ProgressPhoto, pk=photo_id, weight__user=request.user)
        try:
            file = private_storage().open(photo.thumbnail_key if thumbnail else photo.file_key, "rb")
        except FileNotFoundError:
            raise Http404
        response = FileResponse(file, content_type="image/jpeg")
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Disposition"] = 'inline; filename="progress.jpg"'
        patch_vary_headers(response, ["Cookie"])
        return response

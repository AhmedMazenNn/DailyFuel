from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.services import local_today
from .models import WeeklyWeight
from .serializers import WeightInput, parse_week, serialize_week


class WeekPagination(PageNumberPagination):
    page_size = 26


class WeeksView(APIView):
    def get(self, request):
        paginator = WeekPagination()
        records = WeeklyWeight.objects.filter(user=request.user)
        page = paginator.paginate_queryset(records, request)
        return paginator.get_paginated_response([serialize_week(row) for row in page])


class WeekView(APIView):
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

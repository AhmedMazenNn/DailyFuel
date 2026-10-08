from datetime import date as calendar_date
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsVerifiedEmail

from .models import IdempotencyRecord, Meal, MealItem, NutritionDay, SavedFood
from .serializers import ItemSerializer, MealSerializer, OrderSerializer, TargetsSerializer, SavedFoodSerializer, SavedFoodUseSerializer
from .services import (KEYS, day_data, get_day, lock_user, meal_data, numbers,
                       reconcile_rewards, reorder, retry_record, save_meal)


def parse_date(value):
    try:
        parsed = calendar_date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError()
        return parsed
    except (ValueError, TypeError):
        raise ValidationError({"date": ["Use YYYY-MM-DD."]})


def validated(serializer_class, data, partial=False):
    serializer = serializer_class(data=data, partial=partial)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class PrivateView(APIView):
    permission_classes = [IsVerifiedEmail]


class DayView(PrivateView):
    def get(self, request, date):
        return Response(day_data(request.user, parse_date(date)))

    @transaction.atomic
    def put(self, request, date):
        date = parse_date(date)
        values = validated(TargetsSerializer, request.data)["targets"]
        lock_user(request.user)
        # Explicit target setup can create a day without inheritance.
        NutritionDay.objects.update_or_create(user=request.user, local_date=date, defaults={
            "target_calories": values["calories"], "target_protein_g": values["protein"], "target_carbohydrate_g": values["carbohydrate"],
            "target_fat_g": values["fat"]})
        return Response(day_data(request.user, date))


class MealsView(PrivateView):
    def get(self, request, date):
        return Response(day_data(request.user, parse_date(date))["meals"])

    @transaction.atomic
    def post(self, request, date):
        date = parse_date(date)
        data = validated(MealSerializer, request.data)
        lock_user(request.user)
        key = request.headers.get("Idempotency-Key")
        previous, fingerprint = retry_record(request.user, date, key, request.data)
        if previous:
            return Response({**previous.response, "day": day_data(request.user, date),
                             "gamification": reconcile_rewards(request.user)}, status=201)
        day = get_day(request.user, date)
        meal = save_meal(day, data)
        snapshot = day_data(request.user, date, day)
        response = next(entry for entry in snapshot["meals"] if entry["id"] == str(meal.pk))
        if key:
            IdempotencyRecord.objects.create(user=request.user, key=key, fingerprint=fingerprint, response=response)
        return Response({**response, "day": snapshot, "gamification": reconcile_rewards(request.user)}, status=201)


class MealView(PrivateView):
    def owned(self, request, pk):
        return get_object_or_404(Meal.objects.select_related("nutrition_day", "nutrition_day__user"),
                                 pk=pk, nutrition_day__user=request.user)

    def get(self, request, pk):
        return Response(meal_data(self.owned(request, pk)))

    @transaction.atomic
    def patch(self, request, pk):
        data = validated(MealSerializer, request.data)
        lock_user(request.user)
        meal = self.owned(request, pk)
        save_meal(meal.nutrition_day, data, meal)
        snapshot = day_data(request.user, meal.nutrition_day.local_date, meal.nutrition_day)
        response = next(entry for entry in snapshot["meals"] if entry["id"] == str(meal.pk))
        return Response({**response, "day": snapshot, "gamification": reconcile_rewards(request.user)})

    @transaction.atomic
    def delete(self, request, pk):
        lock_user(request.user)
        self.owned(request, pk).delete()
        reconcile_rewards(request.user)
        return Response(status=204)


class MealOrderView(PrivateView):
    @transaction.atomic
    def post(self, request, date):
        date = parse_date(date)
        ids = validated(OrderSerializer, request.data)["ids"]
        lock_user(request.user)
        day = get_object_or_404(NutritionDay, user=request.user, local_date=date)
        reorder(day.meals.all(), ids)
        return Response(day_data(request.user, date, day))


class ItemsView(MealView):
    @transaction.atomic
    def post(self, request, pk):
        data = validated(ItemSerializer, request.data)
        if "id" in data:
            raise ValidationError({"id": ["New items must not supply an ID."]})
        if "saved_food_id" in data:
            return SavedFoodItemView().post(request, pk)
        lock_user(request.user)
        meal = self.owned(request, pk)
        if meal.entry_mode != "itemized":
            raise ValidationError({"mode": ["Items require an itemized meal."]})
        last = meal.items.order_by("-position").first()
        if meal.items.count() >= 200:
            raise ValidationError({"items": ["Maximum 200 items per meal."]})
        MealItem.objects.create(meal=meal, name=data["name"], position=last.position + 1 if last else 0,
                                calories=data["calories"], protein_g=data["protein"], fat_g=data["fat"])
        return Response(meal_data(meal), status=201)


class ItemView(PrivateView):
    def owned(self, request, pk):
        return get_object_or_404(MealItem.objects.select_related("meal", "meal__nutrition_day"),
                                 pk=pk, meal__nutrition_day__user=request.user)

    @transaction.atomic
    def patch(self, request, pk):
        data = validated(ItemSerializer, request.data, partial=True)
        if "id" in data:
            raise ValidationError({"id": ["Item IDs cannot be changed."]})
        lock_user(request.user)
        item = self.owned(request, pk)
        if "saved_food_id" in data:
            rows = []
            for row in item.meal.items.all():
                rows.append({"id": row.pk, "name": row.name, "calories": row.calories, "protein": row.protein_g, "carbohydrate": row.carbohydrate_g, "fat": row.fat_g})
                if row.saved_food_id and row.amount_g:
                    rows[-1].update(saved_food_id=row.saved_food_id, amount_g=row.amount_g)
                if row.pk == item.pk:
                    rows[-1] = {**data, "id": row.pk}
            save_meal(item.meal.nutrition_day, {"items": rows}, meal=item.meal)
            return Response(meal_data(item.meal))
        for key, attr in (("name", "name"), ("calories", "calories"), ("protein", "protein_g"), ("fat", "fat_g")):
            if key in data:
                setattr(item, attr, data[key])
        item.save()
        return Response(meal_data(item.meal))

    @transaction.atomic
    def delete(self, request, pk):
        lock_user(request.user)
        item = self.owned(request, pk)
        if item.meal.items.count() == 1:
            raise ValidationError({"items": ["An itemized meal must retain at least one item; delete the meal instead."]})
        item.delete()
        return Response(status=204)


class SavedFoodListView(PrivateView):
    def get(self, request):
        foods = SavedFood.objects.filter(user=request.user, is_archived=False)
        query = request.query_params.get("search", "").strip()
        if query:
            foods = foods.filter(name__icontains=query)
        return Response(SavedFoodSerializer(foods, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = SavedFoodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(SavedFoodSerializer(SavedFood.objects.create(user=request.user, **serializer.validated_data)).data, status=201)


class SavedFoodDetailView(PrivateView):
    def owned(self, request, pk):
        return get_object_or_404(SavedFood, pk=pk, user=request.user)

    def get(self, request, pk):
        return Response(SavedFoodSerializer(self.owned(request, pk)).data)

    @transaction.atomic
    def patch(self, request, pk):
        food = self.owned(request, pk)
        serializer = SavedFoodSerializer(food, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True); serializer.save()
        return Response(SavedFoodSerializer(food).data)

    @transaction.atomic
    def delete(self, request, pk):
        food = self.owned(request, pk)
        food.is_archived = True; food.save(update_fields=["is_archived", "updated_at"])
        return Response(status=204)


class SavedFoodItemView(PrivateView):
    @transaction.atomic
    def post(self, request, pk):
        data = validated(SavedFoodUseSerializer, request.data)
        lock_user(request.user)
        meal = get_object_or_404(Meal.objects.select_related("nutrition_day"), pk=pk, nutrition_day__user=request.user)
        if meal.entry_mode != "itemized":
            raise ValidationError({"mode": ["Saved foods require an itemized meal."]})
        food = get_object_or_404(SavedFood, pk=data["saved_food_id"], user=request.user, is_archived=False)
        if data["amount_g"] <= 0:
            raise ValidationError({"amount_g": ["Must be greater than zero."]})
        if meal.items.count() >= 200:
            raise ValidationError({"items": ["Maximum 200 items per meal."]})
        multiplier = data["amount_g"] / food.serving_amount_g
        last = meal.items.order_by("-position").first()
        item = MealItem.objects.create(meal=meal, saved_food=food, source_type="saved_food", name=food.name,
            position=last.position + 1 if last else 0, amount_g=data["amount_g"], serving_amount_snapshot_g=food.serving_amount_g,
            calories=food.calories_per_serving * multiplier, protein_g=food.protein_g_per_serving * multiplier,
            fat_g=food.fat_g_per_serving * multiplier, carbohydrate_g=(food.carbs_g_per_serving or 0) * multiplier,
            carbs_g=(food.carbs_g_per_serving * multiplier if food.carbs_g_per_serving is not None else None))
        return Response(meal_data(meal), status=201)


class ItemOrderView(MealView):
    @transaction.atomic
    def post(self, request, pk):
        ids = validated(OrderSerializer, request.data)["ids"]
        lock_user(request.user)
        meal = self.owned(request, pk)
        if meal.entry_mode != "itemized":
            raise ValidationError({"mode": ["Items require an itemized meal."]})
        reorder(meal.items.all(), ids)
        return Response(meal_data(meal))


class HistoryPagination(PageNumberPagination):
    page_size = 31


class HistoryView(PrivateView):
    def get(self, request):
        days = NutritionDay.objects.filter(user=request.user).order_by("-local_date")
        start = parse_date(request.query_params["from"]) if "from" in request.query_params else None
        end = parse_date(request.query_params["to"]) if "to" in request.query_params else None
        if start and end and start > end:
            raise ValidationError({"to": ["Must be on or after from."]})
        if start:
            days = days.filter(local_date__gte=start)
        if end:
            days = days.filter(local_date__lte=end)
        paginator = HistoryPagination()
        page = paginator.paginate_queryset(days, request)
        return paginator.get_paginated_response([day_data(request.user, day.local_date, day) for day in page])


class GamificationView(PrivateView):
    @transaction.atomic
    def get(self, request):
        lock_user(request.user)
        return Response(reconcile_rewards(request.user))

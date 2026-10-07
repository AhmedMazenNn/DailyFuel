from rest_framework import serializers
from .models import SavedFood


class MacrosSerializer(serializers.Serializer):
    calories = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=0)
    protein = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=0)
    carbohydrate = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=0, required=False, default=0)
    fat = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=0)


class ItemSerializer(MacrosSerializer):
    id = serializers.UUIDField(required=False)
    name = serializers.CharField(max_length=120)


class MealSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    mode = serializers.ChoiceField(choices=["quick", "itemized"], required=False)
    note = serializers.CharField(required=False, allow_blank=True, max_length=10000)
    totals = MacrosSerializer(required=False)
    # Quick meals intentionally send items=[]; itemized mode is validated in the service,
    # where the mode transition and at-least-one-item rule are transactional.
    items = ItemSerializer(many=True, required=False, allow_empty=True, max_length=200)


class TargetsSerializer(serializers.Serializer):
    targets = MacrosSerializer()


class OrderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=True, max_length=1000)

class SavedFoodSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedFood
        fields = ("id", "name", "brand", "serving_amount_g", "calories_per_serving", "protein_g_per_serving", "fat_g_per_serving", "carbs_g_per_serving", "notes", "is_archived", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        for key in ("serving_amount_g", "calories_per_serving", "protein_g_per_serving", "fat_g_per_serving", "carbs_g_per_serving"):
            if key in attrs and attrs[key] is not None and attrs[key] < 0:
                raise serializers.ValidationError({key: "Must be non-negative."})
        if "serving_amount_g" in attrs and attrs["serving_amount_g"] <= 0:
            raise serializers.ValidationError({"serving_amount_g": "Must be greater than zero."})
        return attrs

class SavedFoodUseSerializer(serializers.Serializer):
    saved_food_id = serializers.UUIDField()
    amount_g = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=0)

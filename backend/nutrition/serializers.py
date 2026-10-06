from rest_framework import serializers


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

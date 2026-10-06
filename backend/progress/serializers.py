from datetime import date, timedelta
from decimal import Decimal
from rest_framework import serializers


def parse_week(value):
    try:
        parsed = date.fromisoformat(value)
    except (ValueError, TypeError):
        raise serializers.ValidationError({"weekStart": "Use a date in YYYY-MM-DD format."})
    if parsed.isoformat() != value or parsed.weekday() != 0:
        raise serializers.ValidationError({"weekStart": "A progress week starts on Monday."})
    return parsed


class WeightInput(serializers.Serializer):
    weightKg = serializers.DecimalField(max_digits=7, decimal_places=3, min_value=Decimal("0.001"))
    measuredOn = serializers.DateField(required=False)
    note = serializers.CharField(max_length=500, allow_blank=True, required=False)

    def validate(self, attrs):
        week = self.context["week"]
        if "measuredOn" in attrs and not week <= attrs["measuredOn"] <= week + timedelta(days=6):
            raise serializers.ValidationError({"measuredOn": "Choose a date in the selected week."})
        return attrs


def serialize_week(record, week=None):
    if record is None:
        return {"weekStart": week.isoformat(), "weightKg": None, "measuredOn": None, "note": "", "photos": []}
    return {
        "weekStart": record.week_start.isoformat(),
        "weightKg": float(record.weight_kg),
        "measuredOn": record.measured_on.isoformat(),
        "note": record.note,
        "photos": [],
    }

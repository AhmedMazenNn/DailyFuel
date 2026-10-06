import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="WeeklyWeight",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("week_start", models.DateField()),
                ("measured_on", models.DateField()),
                ("weight_kg", models.DecimalField(decimal_places=3, max_digits=7)),
                ("note", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="weekly_weights", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-week_start"],
                "indexes": [models.Index(fields=["user", "-week_start"], name="progress_we_user_id_1266ca_idx")],
                "constraints": [
                    models.UniqueConstraint(fields=("user", "week_start"), name="unique_user_weight_week"),
                    models.CheckConstraint(condition=models.Q(weight_kg__gt=0), name="positive_weekly_weight"),
                ],
            },
        ),
    ]

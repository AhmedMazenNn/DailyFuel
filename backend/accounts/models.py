import uuid
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Lower

def validate_timezone(value):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValidationError("Enter a valid IANA timezone.")

class UserManager(BaseUserManager):
    use_in_migrations = True
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required.")
        user = self.model(email=email.strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user
    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self.create_user(email, password, **extra)

class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()
    class Meta:
        constraints = [models.UniqueConstraint(Lower("email"), name="accounts_email_case_unique")]
    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=100, blank=True)
    timezone = models.CharField(max_length=64, default="UTC", validators=[validate_timezone])
    locale = models.CharField(max_length=5, choices=[("en", "English"), ("ar", "Arabic")], default="en")
    weight_unit = models.CharField(max_length=2, choices=[("kg", "Kilograms"), ("lb", "Pounds")], default="kg")
    text_size = models.CharField(max_length=10, choices=[("small", "Small"), ("normal", "Normal"), ("large", "Large")], default="normal")
    reduce_motion = models.BooleanField(default=False)
    show_rewards = models.BooleanField(default=True)
    onboarding_complete = models.BooleanField(default=False)
    initial_calories = models.DecimalField(max_digits=9, decimal_places=2, default=0, validators=[MinValueValidator(Decimal("0"))])
    initial_protein = models.DecimalField(max_digits=9, decimal_places=2, default=0, validators=[MinValueValidator(Decimal("0"))])
    initial_fat = models.DecimalField(max_digits=9, decimal_places=2, default=0, validators=[MinValueValidator(Decimal("0"))])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(initial_calories__gte=0, initial_protein__gte=0, initial_fat__gte=0), name="profile_targets_nonnegative")]

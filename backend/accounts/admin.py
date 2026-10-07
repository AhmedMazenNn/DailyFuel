"""Account administration: superusers only, with durable private-media cleanup."""
from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm
from django.contrib.admin.utils import NestedObjects
from django.core.exceptions import PermissionDenied
from django.db import router, transaction
from allauth.account.models import EmailAddress

from progress.models import ProgressPhoto
from progress.services import delete_account
from .models import Profile, User


class AccountChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = ("email", "password", "is_active")

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if EmailAddress.objects.filter(email__iexact=email).exclude(user=self.instance).exists():
            raise forms.ValidationError("This email belongs to another account.")
        return email

    def clean_is_active(self):
        active = self.cleaned_data["is_active"]
        if not active and (self.instance.is_superuser or self.instance.pk == self.actor.pk):
            raise forms.ValidationError("Administrator accounts cannot be deactivated here.")
        return active


class ProfileInline(admin.StackedInline):
    model = Profile
    fields = ("display_name", "timezone", "locale", "weight_unit")
    can_delete = False
    extra = 0
    max_num = 1

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(User)
class AccountAdmin(UserAdmin):
    form = AccountChangeForm
    inlines = (ProfileInline,)
    list_display = ("email", "display_name", "is_active", "is_superuser", "date_joined", "last_login")
    list_filter = ("is_active", "is_superuser", "date_joined")
    search_fields = ("email", "profile__display_name")
    ordering = ("-date_joined", "-pk")
    list_select_related = ("profile",)
    list_per_page = 25
    actions = None
    readonly_fields = ("is_staff", "is_superuser", "date_joined", "last_login")
    fieldsets = (
        ("Account", {"fields": ("email", "password", "is_active")}),
        ("Administrator access", {"fields": ("is_staff", "is_superuser"),
                                  "description": "Administrator privileges are managed outside this page."}),
        ("Dates", {"fields": ("date_joined", "last_login")}),
    )
    filter_horizontal = ()

    @admin.display(description="Name", ordering="profile__display_name")
    def display_name(self, obj):
        return obj.profile.display_name

    @staticmethod
    def _authorized(request):
        return request.user.is_authenticated and request.user.is_active and request.user.is_superuser

    def has_module_permission(self, request):
        return self._authorized(request)

    def has_view_permission(self, request, obj=None):
        return self._authorized(request)

    def has_change_permission(self, request, obj=None):
        return self._authorized(request)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return self._authorized(request) and (obj is None or (not obj.is_superuser and obj.pk != request.user.pk))

    def get_form(self, request, obj=None, **kwargs):
        base = super().get_form(request, obj, **kwargs)

        class ScopedForm(base):
            actor = request.user

        return ScopedForm

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        if not change:
            raise PermissionDenied
        current = User.objects.select_for_update().get(pk=obj.pk)
        if not obj.is_active and (current.is_superuser or current.pk == request.user.pk):
            raise PermissionDenied
        old_email = current.email
        # Preserve roles and credentials changed concurrently by another operator.
        obj.is_staff, obj.is_superuser = current.is_staff, current.is_superuser
        obj.save(update_fields=["email", "is_active"])
        if old_email and old_email != obj.email:
            # A previous address must not remain verified as the new identity.
            EmailAddress.objects.filter(user=obj, email__iexact=old_email).delete()
            EmailAddress.objects.filter(user=obj).update(primary=False)
            EmailAddress.objects.update_or_create(user=obj, email=obj.email,
                                                 defaults={"verified": False, "primary": True})

    def get_deleted_objects(self, objs, request):
        objects = list(objs)
        deleted, counts, permissions, protected = super().get_deleted_objects(objects, request)
        collector = NestedObjects(using=router.db_for_write(User))
        collector.collect(objects)
        ids = {obj.pk for obj in objects}
        # Account deletion removes these photos before their PROTECTed weights.
        # Preserve any future, unrelated protection rather than bypassing it.
        if collector.protected and all(
            isinstance(obj, ProgressPhoto) and obj.weight.user_id in ids
            for obj in collector.protected
        ):
            photo_count = len(collector.protected)
            deleted.append(f"Private progress photos: {photo_count}. Originals and thumbnails will be removed.")
            counts["progress photos"] = photo_count
            protected = []
        return deleted, counts, permissions, protected

    @transaction.atomic
    def delete_model(self, request, obj):
        current = User.objects.select_for_update().get(pk=obj.pk)
        if not self.has_delete_permission(request, current):
            raise PermissionDenied
        delete_account(current)

    def delete_queryset(self, request, queryset):
        # Each account requires its own reviewed confirmation screen.
        raise PermissionDenied


admin.site.site_header = "DailyFuel administration"
admin.site.site_title = "DailyFuel Admin"
admin.site.index_title = "Account management"
admin.site.site_url = "/"

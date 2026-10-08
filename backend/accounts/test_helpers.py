from allauth.account.models import EmailAddress


def verify_test_user(user):
    EmailAddress.objects.update_or_create(
        user=user, email=user.email,
        defaults={"verified": True, "primary": True},
    )
    return user

from allauth.account.models import EmailAddress


def sync_account_email(user, previous_email):
    """Never transfer an old address's verification to a changed identity."""
    if previous_email == user.email:
        return
    EmailAddress.objects.filter(user=user, email__iexact=previous_email).delete()
    EmailAddress.objects.filter(user=user).update(primary=False)
    EmailAddress.objects.update_or_create(user=user, email=user.email,
                                         defaults={"verified": False, "primary": True})

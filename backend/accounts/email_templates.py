"""Shared, autoescaped HTML presentation for transactional emails."""
from django.template.loader import render_to_string


def render_action_email(*, locale, subject, body, action_label, action_url, note,
                        unsubscribe_url=None, unsubscribe_label=None):
    arabic = locale == "ar"
    return render_to_string("accounts/email/action.html", {
        "locale": "ar" if arabic else "en", "direction": "rtl" if arabic else "ltr",
        "align": "right" if arabic else "left", "subject": subject, "body": body,
        "action_label": action_label, "action_url": action_url, "note": note,
        "unsubscribe_url": unsubscribe_url, "unsubscribe_label": unsubscribe_label,
        "tagline": "خطوات صغيرة، وثبات كل أسبوع." if arabic else "Small steps. A little consistency.",
        "fallback": "إذا لم يعمل الزر، انسخ هذا الرابط وافتحه في متصفحك:" if arabic else "If the button doesn't work, copy this link into your browser:",
    })

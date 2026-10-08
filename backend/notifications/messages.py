from urllib.parse import urlencode
from django.conf import settings
from django.core import signing
from django.core.mail import EmailMultiAlternatives
from accounts.email_templates import render_action_email

CONFIRM_SALT = "dailyfuel.weekly-email.confirm"
UNSUBSCRIBE_SALT = "dailyfuel.weekly-email.unsubscribe"


def confirmation_token(preference):
    return signing.dumps({"uid": preference.user_id, "email": preference.user.email,
                          "nonce": str(preference.confirmation_nonce)}, salt=CONFIRM_SALT)


def unsubscribe_token(preference):
    return signing.dumps({"uid": preference.user_id, "nonce": str(preference.unsubscribe_nonce)}, salt=UNSUBSCRIBE_SALT)


def action_url(preference, action):
    token = confirmation_token(preference) if action == "confirm" else unsubscribe_token(preference)
    return settings.FRONTEND_URL + "/email-preferences/" + action + "?" + urlencode({"token": token, "lang": preference.user.profile.locale})


def make_message(preference, kind):
    arabic = preference.user.profile.locale == "ar"
    if kind == "confirmation":
        subject = "تأكيد تذكير DailyFuel الأسبوعي" if arabic else "Confirm your DailyFuel weekly reminder"
        body = "طلبت تذكيرًا أسبوعيًا عبر البريد. أكّد اختيارك باستخدام الزر أدناه. إذا لم تطلب ذلك، تجاهل هذه الرسالة." if arabic else "You requested a weekly email reminder. Confirm your choice below. If you did not request it, ignore this email."
        label = "تأكيد التذكير الأسبوعي" if arabic else "Confirm weekly reminders"
        url = action_url(preference, "confirm")
    else:
        subject = "موعد متابعة تقدمك الأسبوعي في DailyFuel" if arabic else "Your DailyFuel weekly check-in"
        if preference.include_photos:
            body = "حان وقت متابعة تقدمك الأسبوعي. سجّل وزنك وأضف صور تقدمك إن رغبت، بالوتيرة التي تناسبك." if arabic else "It's time for your weekly check-in. Record your weight and add progress photos if you'd like, at your own pace."
        else:
            body = "حان وقت متابعة تقدمك الأسبوعي. سجّل وزنك عندما يناسبك." if arabic else "It's time for your weekly check-in. Record your weight when it suits you."
        label = "فتح متابعة التقدم" if arabic else "Open Progress"
        url = settings.FRONTEND_URL + "/progress"
    unsubscribe = action_url(preference, "unsubscribe")
    unsub_label = "إيقاف التذكيرات" if arabic else "Unsubscribe from reminders"
    note = ("لن نرسل التذكيرات الأسبوعية حتى تؤكد اختيارك. يمكنك إيقافها في أي وقت." if arabic else "Weekly reminders start only after you confirm. You can turn them off at any time.") if kind == "confirmation" else ("تصلك هذه الرسالة لأنك اخترت تذكيرات التقدم الأسبوعية. يمكنك تغيير الموعد من ملفك الشخصي أو إيقاف التذكيرات أدناه." if arabic else "You're receiving this because you opted in to weekly progress reminders. Change your schedule in Profile or unsubscribe below.")
    text = f"{body}\n\n{label}: {url}\n\n{note}\n\n{unsub_label}: {unsubscribe}"
    html = render_action_email(locale=preference.user.profile.locale, subject=subject, body=body,
                               action_label=label, action_url=url, note=note,
                               unsubscribe_url=unsubscribe, unsubscribe_label=unsub_label)
    message = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [preference.user.email])
    message.attach_alternative(str(html), "text/html")
    return message

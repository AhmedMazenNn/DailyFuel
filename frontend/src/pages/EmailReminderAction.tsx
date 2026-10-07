import { useState } from 'react';
import { CheckCircle2Icon, MailIcon } from 'lucide-react';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { json, request } from '../utils/api';
import { card, primaryButton, secondaryButton } from '../utils/styles';

export function EmailReminderAction({ action }: { action: 'confirm' | 'unsubscribe' }) {
  const params = new URLSearchParams(window.location.search);
  const ar = params.get('lang') === 'ar';
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const token = params.get('token');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const confirm = action === 'confirm';
  const submit = async () => {
    if (!token || busy || complete) return;
    setBusy(true); setError('');
    try { await request('auth/csrf/'); await json(`email-reminders/${action}/`, 'POST', { token }); setComplete(true); }
    catch { setError(text('This link could not be used. It may have expired or been replaced. Open your profile to request a new confirmation or change your preferences.', 'تعذر استخدام الرابط. ربما انتهت صلاحيته أو تم استبداله. افتح ملفك لطلب تأكيد جديد أو تعديل إعداداتك.')); }
    finally { setBusy(false); }
  };
  return <main lang={ar ? 'ar' : 'en'} dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-canvas px-4 py-8 text-ink sm:py-16">
    <div className="mx-auto max-w-lg"><div className="mb-6 flex items-center justify-between"><a href="/" className="font-display text-xl font-extrabold text-ink">DailyFuel</a><ThemeToggle language={ar ? 'ar' : 'en'} /></div>
      <div className={`${card} overflow-hidden`}>
        <div className="hero-surface p-7 text-white sm:p-9"><span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30">{complete ? <CheckCircle2Icon className="h-7 w-7" aria-hidden /> : <MailIcon className="h-7 w-7" aria-hidden />}</span><h1 className="font-display text-2xl font-bold">{complete ? (confirm ? text('Your weekly reminders are confirmed', 'تم تأكيد تذكيراتك الأسبوعية') : text('Weekly emails are turned off', 'تم إيقاف الرسائل الأسبوعية')) : (confirm ? text('Confirm weekly check-in emails', 'تأكيد رسائل المتابعة الأسبوعية') : text('Unsubscribe from weekly emails', 'إلغاء الاشتراك في الرسائل الأسبوعية'))}</h1></div>
        <div className="space-y-5 p-7 sm:p-9">
          <p className="leading-relaxed text-ink-soft">{complete ? (confirm ? text('We will remind you when your weekly check-in is incomplete. You can change your schedule or unsubscribe in your profile.', 'سنذكرك عندما لا تكتمل متابعتك الأسبوعية. يمكنك تعديل موعدك أو إلغاء الاشتراك من ملفك.') : text('You will no longer receive weekly check-in emails. You can subscribe again from your profile.', 'لن تتلقى رسائل المتابعة الأسبوعية. يمكنك الاشتراك مجدداً من ملفك.')) : (confirm ? text('Choose Confirm below to enable the reminders you requested. You can unsubscribe anytime.', 'اختر تأكيد أدناه لتفعيل التذكيرات التي طلبتها. يمكنك إلغاء الاشتراك في أي وقت.') : text('Choose Unsubscribe below to stop weekly check-in emails. Your account and progress stay available.', 'اختر إلغاء الاشتراك أدناه لإيقاف الرسائل الأسبوعية. يبقى حسابك وتقدمك متاحين.'))}</p>
          {(!token || error) && <p role="alert" className="rounded-2xl border border-red-300 p-3 text-sm text-ink">{error || text('This link is missing its security token. Open your profile to manage your reminders.', 'يفتقد الرابط رمز الأمان. افتح ملفك لإدارة تذكيراتك.')}</p>}
          {!complete && token && <button type="button" disabled={busy} onClick={() => void submit()} className={`${primaryButton} w-full`}>{busy ? text('Please wait…', 'يرجى الانتظار…') : confirm ? text('Confirm weekly emails', 'تأكيد الرسائل الأسبوعية') : text('Unsubscribe', 'إلغاء الاشتراك')}</button>}
          {complete && <p role="status" className="sr-only">{text('Preferences updated successfully.', 'تم تحديث الإعدادات بنجاح.')}</p>}
          <div className="flex flex-wrap gap-3"><a href="/profile" className={secondaryButton}>{text('Manage preferences', 'إدارة الإعدادات')}</a><a href={complete && confirm ? '/progress' : '/'} className={secondaryButton}>{complete && confirm ? text('Open progress', 'فتح التقدم') : text('Open DailyFuel', 'فتح DailyFuel')}</a></div>
        </div>
      </div>
    </div>
  </main>;
}

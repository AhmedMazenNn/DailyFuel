import { useEffect, useState, type FormEvent } from 'react';
import { MailIcon, RefreshCwIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { json, request } from '../../utils/api';
import { inputBase, inputBorder, primaryButton, secondaryButton } from '../../utils/styles';
import { SettingsSection } from './SettingsSection';

interface Preferences {
  available: boolean; enabled: boolean; confirmed: boolean; weekday: number;
  time: string; includePhotos: boolean; timezone: string;
  nextDueAt: string | null; confirmationSentAt: string | null;
}
export function WeeklyEmailSettings() {
  const { lang } = useApp();
  const { refresh } = useAuth();
  const ar = lang === 'ar';
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [saved, setSaved] = useState<Preferences | null>(null);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const value = await request<Preferences>('email-reminders/'); setSaved(value); setDraft(value); }
    catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { let active = true;
    void request<Preferences>('email-reminders/').then(value => { if (active) { setSaved(value); setDraft(value); } }).catch(cause => { if (active) setError((cause as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!draft || !saved) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const value = await json<Preferences>('email-reminders/', 'PATCH', {
        enabled: draft.enabled, weekday: draft.weekday, time: draft.time,
        includePhotos: draft.includePhotos, timezone: draft.timezone,
      });
      setSaved(value); setDraft(value);
      if (value.timezone !== saved.timezone) await refresh();
      setNotice(value.enabled && !value.confirmed ? text('Check your inbox to confirm your weekly reminders.', 'تحقق من بريدك لتأكيد التذكيرات الأسبوعية.') : text('Reminder preferences saved.', 'تم حفظ إعدادات التذكير.'));
    } catch (cause) {
      setError((cause as Error).message);
      // Delivery can fail after the server saves pending consent. Read the actual
      // state so the user can retry confirmation without subscribing twice.
      try {
        const value = await request<Preferences>('email-reminders/');
        setSaved(value); setDraft(value);
        if (value.timezone !== saved.timezone) await refresh();
      } catch { /* Preserve the original error and current draft for retry. */ }
    }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await json('email-reminders/confirmation/', 'POST'); setNotice(text('Confirmation email sent. You can request another after one hour.', 'تم إرسال رسالة التأكيد. يمكنك طلب رسالة أخرى بعد ساعة.')); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const weekdays = ar ? ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let nextDate = '';
  if (saved?.nextDueAt) {
    try { nextDate = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: saved.timezone }).format(new Date(saved.nextDueAt)); } catch { /* Invalid server dates are not shown. */ }
  }
  return <SettingsSection id="s-weekly-email" title={text('Weekly email check-in', 'تذكير المتابعة الأسبوعية بالبريد')} hint={text('A gentle reminder to log your weight and optional progress photos.', 'تذكير لتسجيل وزنك وصور تقدمك الاختيارية.')}>
    {loading && <p role="status" className="text-sm text-ink-soft">{text('Loading preferences…', 'جارٍ تحميل الإعدادات…')}</p>}
    {error && <div role="alert" className="mb-3 rounded-2xl border border-red-300 p-3 text-sm text-ink"><p>{error}</p>{!draft && <button type="button" onClick={() => void load()} className={`${secondaryButton} mt-2`}><RefreshCwIcon className="h-4 w-4" />{text('Try again', 'إعادة المحاولة')}</button>}</div>}
    {draft && <form onSubmit={save} className="space-y-4">
      {!draft.available && <p className="rounded-2xl bg-canvas p-3 text-sm text-ink-soft">{text("Weekly email reminders aren't available yet. You can still save your preferred schedule.", 'التذكيرات الأسبوعية غير متاحة بعد. يمكنك حفظ موعدك المفضل.')}</p>}
      <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-50 p-4">
          <input type="checkbox" checked={draft.enabled} disabled={!draft.available && !draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} className="mt-1 h-5 w-5 accent-brand-600" />
          <span><span className="block text-sm font-semibold text-ink">{text('Send me weekly check-in emails', 'أرسل لي تذكيرات أسبوعية بالبريد')}</span><span className="mt-1 block text-sm text-ink-soft">{text('I agree to receive these reminders. Confirm your email to start; unsubscribe anytime.', 'أوافق على تلقي هذه التذكيرات. أكد بريدك للبدء ويمكنك إلغاء الاشتراك في أي وقت.')}</span></span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-ink-soft">{text('Reminder day', 'يوم التذكير')}<select value={draft.weekday} onChange={event => setDraft({ ...draft, weekday: Number(event.target.value) })} className={`${inputBase} ${inputBorder()} mt-1.5 h-12`}>{weekdays.map((day, index) => <option key={index} value={index}>{day}</option>)}</select></label>
          <label className="block text-sm font-medium text-ink-soft">{text('Time', 'الوقت')}<input type="time" required step={60} value={draft.time} onChange={event => setDraft({ ...draft, time: event.target.value })} className={`${inputBase} ${inputBorder()} mt-1.5 h-12`} /></label>
        </div>
        <label className="block text-sm font-medium text-ink-soft">{text('Time zone', 'المنطقة الزمنية')}<input required list="reminder-time-zones" value={draft.timezone} dir="ltr" placeholder="Africa/Cairo" onChange={event => setDraft({ ...draft, timezone: event.target.value })} className={`${inputBase} ${inputBorder()} mt-1.5 h-12`} /><span className="mt-1 block text-xs">{text('Saving this also updates your profile time zone. Daylight saving changes are handled automatically.', 'يحدّث الحفظ المنطقة الزمنية لملفك أيضاً. تُراعى تغييرات التوقيت الصيفي تلقائياً.')}</span></label>
        <datalist id="reminder-time-zones">{[...new Set([draft.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone, 'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Australia/Sydney', 'UTC'])].map(zone => <option key={zone} value={zone} />)}</datalist>
        <button type="button" className={secondaryButton} onClick={() => setDraft({ ...draft, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>{text('Use my device time zone', 'استخدام المنطقة الزمنية لجهازي')}</button>
        <label className="flex items-start gap-3 text-sm text-ink"><input type="checkbox" checked={draft.includePhotos} onChange={event => setDraft({ ...draft, includePhotos: event.target.checked })} className="mt-0.5 h-5 w-5 accent-brand-600" /><span>{text('Include a progress-photo reminder', 'تضمين تذكير بصور التقدم')}<span className="mt-1 block text-ink-soft">{text('Photos are optional. We never attach your body photos to emails.', 'الصور اختيارية. لا نرفق صور جسمك برسائل البريد.')}</span></span></label>
        <p className="text-xs leading-relaxed text-ink-soft">{text('One reminder per week when your check-in is incomplete. We skip it once your weight and, if selected, a progress photo are saved for that week.', 'تذكير واحد أسبوعياً إذا لم تكتمل متابعتك. نتخطاه بعد تسجيل الوزن وصورة تقدم إذا اخترت التذكير بالصور.')}</p>
        <button type="submit" className={`${primaryButton} w-full`}><MailIcon className="h-4 w-4" aria-hidden />{busy ? text('Saving…', 'جارٍ الحفظ…') : text('Save reminder preferences', 'حفظ إعدادات التذكير')}</button>
      </fieldset>
      {saved?.enabled && !saved.confirmed && <div className="rounded-2xl border border-line bg-canvas p-4"><p className="text-sm font-semibold text-ink">{text('Waiting for email confirmation', 'بانتظار تأكيد البريد')}</p><p className="mt-1 text-sm text-ink-soft">{text('No reminders are sent until you confirm. Check your inbox and spam folder.', 'لن نرسل تذكيرات حتى تؤكد بريدك. تحقق من الوارد والبريد غير المرغوب.')}</p><button type="button" disabled={busy} onClick={() => void resend()} className={`${secondaryButton} mt-3 disabled:opacity-60`}>{text('Resend confirmation', 'إعادة إرسال التأكيد')}</button></div>}
      {saved?.enabled && saved.confirmed && nextDate && <p className="text-sm text-ink-soft">{text('Next scheduled check-in:', 'المتابعة القادمة:')} <span className="font-semibold text-ink">{nextDate}</span> <span dir="ltr">({saved.timezone})</span></p>}
      {notice && <p role="status" className="rounded-2xl bg-brand-50 p-3 text-sm text-ink">{notice}</p>}
    </form>}
  </SettingsSection>;
}

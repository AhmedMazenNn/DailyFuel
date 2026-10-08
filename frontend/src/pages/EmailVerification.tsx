import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { json, request } from '../utils/api';
import { card, primaryButton, secondaryButton } from '../utils/styles';

export function EmailVerification() {
  const { session } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('verify_email');
  const [ar, setAr] = useState(params.get('lang') === 'ar' || session?.profile?.language === 'ar');
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const verify = async () => {
    if (!token || busy || complete) return;
    setBusy(true); setError('');
    try {
      await request('auth/csrf/');
      await json('auth/email/verify/', 'POST', { token });
      setComplete(true);
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      setError(text('This link could not be used. It may have expired or been replaced. Sign in and request a new verification email from your profile.', 'تعذر استخدام الرابط. ربما انتهت صلاحيته أو تم استبداله. سجل الدخول واطلب رسالة تحقق جديدة من ملفك الشخصي.'));
    } finally { setBusy(false); }
  };
  return <main lang={ar ? 'ar' : 'en'} dir={ar ? 'rtl' : 'ltr'} className="app-backdrop min-h-screen px-4 py-10 text-ink">
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-between gap-3"><a href="/" className="font-display text-xl font-extrabold">DailyFuel</a><button className={secondaryButton} onClick={() => setAr(!ar)}>{ar ? 'English' : 'العربية'}</button></div>
      <div className={`${card} space-y-5 p-7`}>
        <h1 className="font-display text-2xl font-bold">{complete ? text('Email verified', 'تم تأكيد البريد الإلكتروني') : text('Verify your email', 'تأكيد بريدك الإلكتروني')}</h1>
        <p role={complete ? 'status' : undefined} className="text-ink-soft">{complete ? text('Your email address is now verified.', 'تم تأكيد عنوان بريدك الإلكتروني.') : text('Choose Verify email to confirm that this email address belongs to you.', 'اختر تأكيد البريد الإلكتروني لتأكيد ملكيتك لهذا العنوان.')}</p>
        {((!token && !complete) || error) && <p role="alert" className="text-sm text-red-700">{error || text('This verification link is incomplete. Request a new email from your profile.', 'رابط التأكيد غير مكتمل. اطلب رسالة جديدة من ملفك الشخصي.')}</p>}
        {!complete && token && <button disabled={busy} onClick={() => void verify()} className={`${primaryButton} w-full`}>{busy ? text('Please wait…', 'يرجى الانتظار…') : text('Verify email', 'تأكيد البريد الإلكتروني')}</button>}
        <a href={complete ? '/' : '/profile'} className={secondaryButton}>{complete ? text('Continue to DailyFuel', 'المتابعة إلى DailyFuel') : text('Open profile', 'فتح الملف الشخصي')}</a>
      </div>
    </div>
  </main>;
}

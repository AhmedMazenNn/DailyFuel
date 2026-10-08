import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { json } from '../../utils/api';
import { secondaryButton } from '../../utils/styles';
import { SettingsSection } from './SettingsSection';

export function EmailVerificationStatus() {
  const { session } = useAuth();
  const ar = session?.profile?.language === 'ar';
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const user = session?.user;
  if (!user) return null;
  const resend = async () => {
    if (busy) return;
    setBusy(true); setError(''); setSent(false);
    try { await json('auth/email/resend/', 'POST'); setSent(true); }
    catch { setError(text('Unable to send a verification email right now. Please try again later.', 'تعذر إرسال رسالة التأكيد الآن. يرجى المحاولة لاحقاً.')); }
    finally { setBusy(false); }
  };
  return <SettingsSection id="s-email-verification" title={text('Email verification', 'تأكيد البريد الإلكتروني')}>
    <p className="text-sm text-ink-soft">{user.emailVerified ? text('Your email is verified.', 'تم تأكيد بريدك الإلكتروني.') : text('Confirm your email address using the link in your verification email. You can keep using DailyFuel.', 'أكد بريدك الإلكتروني باستخدام الرابط في رسالة التأكيد. يمكنك الاستمرار في استخدام DailyFuel.')}</p>
    {!user.emailVerified && <>
      {(sent || user.verificationEmailSent) && <p role="status" className="mt-3 text-sm text-brand-700">{text('Verification email sent. Check your inbox and spam folder.', 'تم إرسال رسالة التأكيد. تحقق من بريدك الوارد ومجلد الرسائل غير المرغوب فيها.')}</p>}
      {!sent && user.verificationEmailSent === false && <p role="status" className="mt-3 text-sm text-ink-soft">{text('Your account is ready, but we could not send the verification email. You can request another below.', 'حسابك جاهز، لكن تعذر إرسال رسالة التأكيد. يمكنك طلب رسالة أخرى أدناه.')}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void resend()} className={`${secondaryButton} mt-3`}>{busy ? text('Sending…', 'جارٍ الإرسال…') : text('Resend verification email', 'إعادة إرسال رسالة التأكيد')}</button>
    </>}
  </SettingsSection>;
}

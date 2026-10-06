import React from 'react';
import { LockIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

export function PrivacyNote({ compact }: {compact?: boolean;}) {
  const { t } = useApp();
  if (compact) {
    return (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
        <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
        {t('privacyBody')}
      </p>);

  }
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-brand-50 p-4 ring-1 ring-brand-100">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-600" aria-hidden>
        <LockIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand-900">{t('privacyTitle')}</p>
        <p className="mt-0.5 text-sm text-brand-900/80">{t('privacyBody')}</p>
        <p className="mt-1.5 text-xs text-brand-900/75">{t('separateRecords')}</p>
      </div>
    </div>);

}
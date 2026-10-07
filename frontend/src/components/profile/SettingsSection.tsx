import React from 'react';
import { card } from '../../utils/styles';

interface SettingsSectionProps {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}

export function SettingsSection({ id, title, hint, children }: SettingsSectionProps) {
  return (
    <section aria-labelledby={id} className={`${card} p-5`}>
      <h2 id={id} className="font-display text-lg font-bold text-ink">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>);

}
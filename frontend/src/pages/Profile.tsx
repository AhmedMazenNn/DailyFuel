import React, { useState } from 'react';
import { toast } from 'sonner';
import { FlameIcon, LogOutIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { TODAY } from '../utils/date';
import { inputBase, inputBorder, secondaryButton } from '../utils/styles';
import type { Language, TextSize, WeightUnit } from '../types/nutrition';
import { BadgeGrid } from '../components/profile/BadgeGrid';
import { SettingsSection } from '../components/profile/SettingsSection';
import { TargetsForm } from '../components/targets/TargetsForm';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Switch } from '../components/ui/Switch';

export function Profile() {
  const { t, fmt, settings, updateSettings, stats, getTargets, setTargets } = useApp();
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try { await logout(); }
    catch (cause) { toast.error((cause as Error).message); setSigningOut(false); }
  };
  const [name, setName] = useState(settings.name);
  const [email, setEmail] = useState(settings.email);
  const [emailError, setEmailError] = useState('');
  const initials = settings.name.
  split(' ').
  map((p) => p[0]).
  slice(0, 2).
  join('');

  const saveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError(t('errEmail'));
      return;
    }
    updateSettings({ name: name.trim() || settings.name, email: email.trim() });
    toast.success(t('saved'));
  };

  return (
    <>
      <PageHeader title={t('profileTitle')} />

      <div className="hero-surface mb-5 flex items-center gap-4 rounded-[28px] p-5 text-white shadow-hero sm:p-6">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 font-display text-xl font-extrabold ring-1 ring-white/30" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">{settings.name}</p>
          <p className="truncate text-sm text-white/85">{settings.email}</p>
        </div>
        {settings.showRewards &&
        <div className="hidden shrink-0 gap-2 sm:flex">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/25">{t('level', { n: fmt(stats.level) })}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-zest-400 px-3 py-1.5 text-sm font-semibold text-ink">
              <FlameIcon className="h-4 w-4" aria-hidden />
              {fmt(stats.streak)}
            </span>
          </div>
        }
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-4">
          <SettingsSection id="s-targets" title={t('dailyTargets')} hint={t('dailyTargetsHint')}>
            <TargetsForm idPrefix="profile" initial={getTargets(TODAY)} onSave={(tg) => setTargets(TODAY, tg)} />
          </SettingsSection>

          <SettingsSection id="s-lang" title={t('language')} hint={t('languageHint')}>
            <SegmentedControl<Language>
              label={t('language')}
              value={settings.language}
              onChange={(language) => updateSettings({ language })}
              options={[
              { value: 'en', label: 'English' },
              { value: 'ar', label: 'العربية' }]
              } />

          </SettingsSection>

          <SettingsSection id="s-units" title={t('units')}>
            <p className="mb-2 text-sm font-medium text-ink-soft">{t('weightUnit')}</p>
            <SegmentedControl<WeightUnit>
              label={t('weightUnit')}
              value={settings.weightUnit}
              onChange={(weightUnit) => updateSettings({ weightUnit })}
              options={[
              { value: 'kg', label: t('kg') },
              { value: 'lb', label: t('lb') }]
              } />

          </SettingsSection>
        </div>

        <div className="space-y-4">
          {settings.showRewards &&
          <SettingsSection id="s-badges" title={t('badges')} hint={t('badgesHint')}>
              <BadgeGrid />
            </SettingsSection>
          }

          <SettingsSection id="s-a11y" title={t('accessibility')}>
            <p className="mb-2 text-sm font-medium text-ink-soft">{t('textSize')}</p>
            <SegmentedControl<TextSize>
              label={t('textSize')}
              value={settings.textSize}
              onChange={(textSize) => updateSettings({ textSize })}
              options={[
              { value: 'default', label: t('textDefault') },
              { value: 'large', label: t('textLarge') }]
              } />

            <div className="mt-2 divide-y divide-line">
              <Switch id="sw-motion" label={t('reduceMotion')} hint={t('reduceMotionHint')} checked={settings.reduceMotion} onChange={(reduceMotion) => updateSettings({ reduceMotion })} />
              <Switch id="sw-rewards" label={t('showRewards')} hint={t('showRewardsHint')} checked={settings.showRewards} onChange={(showRewards) => updateSettings({ showRewards })} />
            </div>
          </SettingsSection>

          <SettingsSection id="s-account" title={t('account')}>
            <form onSubmit={saveAccount} noValidate className="space-y-3">
              <div>
                <label htmlFor="acc-name" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  {t('name')}
                </label>
                <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`${inputBase} ${inputBorder()} h-12`} />
              </div>
              <div>
                <label htmlFor="acc-email" className="mb-1.5 block text-sm font-medium text-ink-soft">
                  {t('email')}
                </label>
                <input
                  id="acc-email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  autoComplete="email"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'acc-email-err' : undefined}
                  className={`${inputBase} ${inputBorder(emailError)} h-12 text-start`} />

                {emailError &&
                <p id="acc-email-err" className="mt-1.5 text-xs font-medium text-red-700">
                    {emailError}
                  </p>
                }
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" className={secondaryButton}>
                  {t('saveAccount')}
                </button>
                <button type="button" onClick={() => void signOut()} disabled={signingOut} aria-busy={signingOut} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-ink-soft hover:bg-canvas disabled:cursor-wait disabled:opacity-60">
                  <LogOutIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
                  {signingOut ? t('signingOut') : t('signOut')}
                </button>
              </div>
            </form>
          </SettingsSection>
        </div>
      </div>
    </>);

}
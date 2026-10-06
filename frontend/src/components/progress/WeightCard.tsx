import React, { useMemo, useState } from 'react';
import { CheckIcon, LoaderCircleIcon, ScaleIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { formatDate, TODAY, weekStartOf } from '../../utils/date';
import { kgToUnit, parseDecimal, round1, unitToKg } from '../../utils/format';
import { card, primaryButton, secondaryButton } from '../../utils/styles';
import { NumberField } from '../ui/NumberField';

const RANGE = { kg: [20, 400], lb: [44, 880] } as const;

export function WeightCard() {
  const { weekly, settings, saveWeight, t, fmt, fmtWeight, lang } = useApp();
  const unit = settings.weightUnit;
  const week = weekStartOf(TODAY);
  const current = weekly[week]?.weightKg ?? null;
  const [editing, setEditing] = useState(current === null);
  const [value, setValue] = useState(current !== null ? String(round1(kgToUnit(current, unit))) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const recent = useMemo(
    () =>
    Object.values(weekly).
    filter((w) => w.weekStart < week).
    sort((a, b) => b.weekStart.localeCompare(a.weekStart)).
    slice(0, 4),
    [weekly, week]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseDecimal(value);
    const [min, max] = RANGE[unit];
    if (n === null || Number.isNaN(n) || n < min || n > max) {
      setError(t('errWeight', { min: fmt(min), max: fmt(max), unit: t(unit) }));
      return;
    }
    setSaving(true);
    await saveWeight(week, round1(unitToKg(n, unit)));
    setSaving(false);
    setEditing(false);
  };

  return (
    <section aria-labelledby="weight-heading" className={`${card} p-5`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden>
          <ScaleIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="weight-heading" className="font-display text-lg font-bold text-ink">
            {t('weeklyWeight')}
          </h2>
          <p className="text-xs text-ink-faint">{t('weekOf', { date: formatDate(week, lang, { month: 'long', day: 'numeric' }) })}</p>
        </div>
      </div>

      {editing ?
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <NumberField
            id="weight-input"
            label={t('thisWeekWeight')}
            suffix={t(unit)}
            value={value}
            placeholder={unit === 'kg' ? '80.5' : '177.5'}
            onChange={(v) => {
              setValue(v);
              setError('');
            }}
            error={error} />

          </div>
          <button type="submit" disabled={saving} className={`${primaryButton} sm:mt-[26px]`}>
            {saving ? <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden /> : <CheckIcon className="h-5 w-5" aria-hidden />}
            {saving ? t('saving') : t('saveWeight')}
          </button>
        </form> :

      <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink-faint">{t('recorded')}</p>
            <p className="font-display text-4xl font-extrabold tracking-tight text-ink tabular">{current !== null ? fmtWeight(current) : '—'}</p>
          </div>
          <button type="button" className={secondaryButton} onClick={() => setEditing(true)}>
            {t('updateWeight')}
          </button>
        </div>
      }
      {editing && current === null && <p className="mt-2 text-xs text-ink-faint">{t('noWeightYet')}</p>}

      {recent.length > 0 &&
      <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-xs font-semibold text-ink-faint">{t('recentWeeks')}</h3>
          <ul className="mt-2 divide-y divide-line/70">
            {recent.map((w) =>
          <li key={w.weekStart} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink-soft">{t('weekOf', { date: formatDate(w.weekStart, lang, { month: 'short', day: 'numeric' }) })}</span>
                <span className="font-semibold text-ink tabular">{w.weightKg !== null ? fmtWeight(w.weightKg) : t('noEntry')}</span>
              </li>
          )}
          </ul>
        </div>
      }
    </section>);

}
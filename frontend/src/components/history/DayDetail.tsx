import { useEffect, useState } from 'react';
import { ArrowLeftIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { mealsForDate } from '../../utils/nutrition';
import { card, secondaryButton } from '../../utils/styles';
import type { Meal } from '../../types/nutrition';
import { MealCard } from '../meals/MealCard';
import { MealSheet } from '../meals/MealSheet';
import { TargetsSheet } from '../targets/TargetsSheet';

interface DayDetailProps {
  date: string;
  onBack: () => void;
}

export function DayDetail({ date, onBack }: DayDetailProps) {
  const { meals, getTargets, t, fmt, formatLong, getTotals, loadDay, setError } = useApp();
  const [sheet, setSheet] = useState<{open: boolean;meal: Meal | null;}>({ open: false, meal: null });
  const [targetsOpen, setTargetsOpen] = useState(false);
  useEffect(() => { void loadDay(date).catch(e=>setError((e as Error).message)); }, [date,loadDay,setError]);
  const dayMeals = mealsForDate(meals, date);
  const totals = getTotals(date);
  const targets = getTargets(date);
  const diff = targets.calories - totals.calories;
  const pct = targets.calories > 0 ? Math.min(100, totals.calories / targets.calories * 100) : 0;

  return (
    <section aria-labelledby="day-detail-heading">
      <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700 lg:hidden">
        <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t('backToDays')}
      </button>

      <div className={`${card} p-5`}>
        <h2 id="day-detail-heading" className="text-sm font-semibold text-ink-soft">
          {formatLong(date)}
        </h2>
        <p className="mt-2 font-display tabular">
          <span className="text-5xl font-extrabold tracking-tight text-ink">{fmt(totals.calories)}</span>
          <span className="ms-1.5 text-base font-medium text-ink-faint">
            / {fmt(targets.calories)} {t('kcal')}
          </span>
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm font-medium text-ink-soft tabular">
          {diff >= 0 ? t('kcalLeft', { n: fmt(diff) }) : t('kcalOver', { n: fmt(Math.abs(diff)) })}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 tabular">
          <div className="rounded-2xl bg-protein-soft px-4 py-3">
            <dt className="text-xs font-semibold text-protein-ink">{t('protein')}</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              {fmt(totals.protein, 1)} <span className="text-sm font-normal text-ink-soft">/ {fmt(targets.protein, 1)} {t('g')}</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-fat-soft px-4 py-3">
            <dt className="text-xs font-semibold text-fat-ink">{t('fat')}</dt>
            <dd className="mt-0.5 font-semibold text-ink">
              {fmt(totals.fat, 1)} <span className="text-sm font-normal text-ink-soft">/ {fmt(targets.fat, 1)} {t('g')}</span>
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-faint">{t('targetsThatDay')}</p>
            <p className="truncate text-sm text-ink tabular">
              {fmt(targets.calories)} {t('kcal')} · {t('protein')} {fmt(targets.protein, 1)} {t('g')} · {t('fat')} {fmt(targets.fat, 1)} {t('g')}
            </p>
          </div>
          <button type="button" onClick={() => setTargetsOpen(true)} className={`${secondaryButton} shrink-0`}>
            <PencilIcon className="h-4 w-4" aria-hidden />
            {t('editTargets')}
          </button>
        </div>
      </div>

      <h3 className="mb-3 mt-6 font-display text-lg font-bold text-ink">{t('meals')}</h3>
      {dayMeals.length === 0 ?
      <p className="rounded-3xl border border-dashed border-brand-200 bg-white/70 px-5 py-8 text-center text-sm text-ink-soft">{t('noMealsDay')}</p> :

      <ul className="space-y-3">
          {dayMeals.map((m) =>
        <li key={m.id}>
              <MealCard meal={m} onEdit={(meal) => setSheet({ open: true, meal })} />
            </li>
        )}
        </ul>
      }
      <button type="button" onClick={() => setSheet({ open: true, meal: null })} className={`${secondaryButton} mt-4 w-full`}>
        <PlusIcon className="h-4 w-4" aria-hidden />
        {t('addMealTo')}
      </button>

      <MealSheet open={sheet.open} meal={sheet.meal} date={date} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
      <TargetsSheet open={targetsOpen} date={date} onClose={() => setTargetsOpen(false)} />
    </section>);

}
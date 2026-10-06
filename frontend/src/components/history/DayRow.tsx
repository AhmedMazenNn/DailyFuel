import { ChevronRightIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { formatDate } from '../../utils/date';
import { mealsForDate } from '../../utils/nutrition';

interface DayRowProps {
  date: string;
  selected: boolean;
  onSelect: (date: string) => void;
}

export function DayRow({ date, selected, onSelect }: DayRowProps) {
  const { meals, getTargets, t, fmt, lang, formatDay, today, getTotals } = useApp();
  const dayMeals = mealsForDate(meals, date);
  const totals = getTotals(date);
  const target = getTargets(date).calories;
  const over = totals.calories - target;
  const pct = target > 0 ? Math.min(100, totals.calories / target * 100) : 0;
  const empty = dayMeals.length === 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-current={selected ? 'true' : undefined}
      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-start transition-colors duration-150 sm:gap-4 ${
      selected ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-canvas'}`
      }>
      
      <div className="w-12 shrink-0 text-center">
        <p className="text-xs font-medium text-ink-faint">{date === today ? t('today') : formatDate(date, lang, { weekday: 'short' })}</p>
        <p className="font-display text-xl font-bold text-ink tabular">{formatDate(date, lang, { day: 'numeric' })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <span className="sr-only">{formatDay(date)}</span>
        {empty ?
        <p className="text-sm text-ink-faint">{t('noLog')}</p> :

        <>
            <div className="flex items-baseline justify-between gap-2 tabular">
              <p className="truncate">
                <span className="font-display text-lg font-bold text-ink">{fmt(totals.calories)}</span>
                <span className="text-sm text-ink-faint">
                  {' '}
                  / {fmt(target)} {t('kcal')}
                </span>
              </p>
              {over > 0 &&
            <span className="shrink-0 rounded-full bg-ink/[0.06] px-2 py-0.5 text-xs font-semibold text-ink-soft">
                  +{fmt(over)} {t('over')}
                </span>
            }
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 truncate text-xs text-ink-faint tabular">
              {t('protein')} {fmt(totals.protein, 1)} {t('g')} · {t('fat')} {fmt(totals.fat, 1)} {t('g')} · {t('mealsCount', { n: fmt(dayMeals.length) })}
            </p>
          </>
        }
      </div>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-faint rtl:rotate-180" aria-hidden />
    </button>);

}
import { ListIcon, ZapIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { Meal } from '../../types/nutrition';

interface MealCardProps {
  meal: Meal;
  onEdit: (meal: Meal) => void;
}

export function MealCard({ meal, onEdit }: MealCardProps) {
  const { t, fmt } = useApp();
  const itemized = meal.mode === 'itemized';
  const summary = itemized ? meal.items.map((i) => i.name).join(' · ') : meal.note;

  return (
    <button
      type="button"
      onClick={() => onEdit(meal)}
      aria-label={`${t('editMeal')}: ${meal.name}, ${fmt(meal.totals.calories)} ${t('kcal')}`}
      className="w-full rounded-3xl bg-white p-4 text-start shadow-card ring-1 ring-line transition-[box-shadow,transform] duration-150 hover:ring-brand-200 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
      
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{meal.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-ink-faint">
            {itemized ? <ListIcon className="h-3.5 w-3.5" aria-hidden /> : <ZapIcon className="h-3.5 w-3.5" aria-hidden />}
            {itemized ? `${t('itemized')} · ${t('itemsCount', { n: fmt(meal.items.length) })}` : t('quick')}
          </p>
        </div>
        <p className="shrink-0 text-end font-display tabular">
          <span className="text-xl font-bold text-ink">{fmt(meal.totals.calories)}</span>
          <span className="ms-1 text-xs font-medium text-ink-faint">{t('kcal')}</span>
        </p>
      </div>
      {summary && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{summary}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold tabular">
        <span className="rounded-full bg-protein-soft px-2.5 py-1 text-protein-ink">
          {t('protein')} {fmt(meal.totals.protein, 1)} {t('g')}
        </span>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
          {t('carbohydrate')} {fmt(meal.totals.carbohydrate, 1)} {t('g')}
        </span>
        <span className="rounded-full bg-fat-soft px-2.5 py-1 text-fat-ink">
          {t('fat')} {fmt(meal.totals.fat, 1)} {t('g')}
        </span>
      </div>
    </button>);

}

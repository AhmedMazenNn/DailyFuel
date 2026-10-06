import { useApp } from '../../contexts/AppContext';
import { addDays, formatDate } from '../../utils/date';
import { weekSummary } from '../../utils/gamification';

export function WeeklyRecap() {
  const { meals, t, fmt, lang, today } = useApp();
  const s = weekSummary(meals, today);
  const logged = new Set(meals.map((m) => m.date));
  const days = Array.from({ length: 7 }, (_, i) => addDays(s.start, i));

  return (
    <section aria-labelledby="recap-heading" className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="recap-heading" className="font-display text-lg font-bold text-ink">
            {t('thisWeek')}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">{s.daysLogged >= 3 ? t('recapMsg') : t('recapMsgStart')}</p>
        </div>

      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label={t('recapDays', { n: fmt(s.daysLogged) })}>
        {days.map((d) => {
          const done = logged.has(d);
          const future = d > today;
          return (
            <li key={d} className="flex flex-col items-center gap-1.5">
              <span
                className={`grid h-9 w-full max-w-[44px] place-items-center rounded-xl text-xs font-semibold ${
                done ? 'bg-brand-600 text-white' : future ? 'bg-canvas text-ink-faint/60' : 'bg-canvas text-ink-faint ring-1 ring-line'} ${
                d === today ? 'ring-2 ring-brand-200 ring-offset-1' : ''}`}>
                
                {formatDate(d, lang, { day: 'numeric' })}
              </span>
              <span className="text-[11px] text-ink-faint">{formatDate(d, lang, { weekday: 'narrow' })}</span>
            </li>);

        })}
      </ol>
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft tabular">
        <div>
          <dt className="sr-only">{t('thisWeek')}</dt>
          <dd className="font-semibold text-ink">{t('recapDays', { n: fmt(s.daysLogged) })}</dd>
        </div>
        <div>
          <dt className="sr-only">{t('meals')}</dt>
          <dd>{t('mealsCount', { n: fmt(s.mealCount) })}</dd>
        </div>
        {s.avgKcal > 0 &&
        <div>
            <dt className="sr-only">{t('calories')}</dt>
            <dd>{t('recapAvg', { n: fmt(s.avgKcal) })}</dd>
          </div>
        }
      </dl>
    </section>);

}
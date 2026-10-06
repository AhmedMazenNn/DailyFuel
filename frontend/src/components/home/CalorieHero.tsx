import { forwardRef } from 'react';
import { TargetIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useCountUp } from '../../hooks/useCountUp';
import { TODAY } from '../../utils/date';
import { ProgressRing } from './ProgressRing';

interface CalorieHeroProps {
  date: string;
  consumed: number;
  target: number;
  onEditTargets: () => void;
}

export const CalorieHero = forwardRef<HTMLElement, CalorieHeroProps>(function CalorieHero(
{ date, consumed, target, onEditTargets },
ref)
{
  const { t, fmt, reduceMotion, formatDay, formatLong } = useApp();
  const shown = useCountUp(consumed, reduceMotion);
  const diff = target - consumed;
  const ratio = target > 0 ? consumed / target : 0;
  const consumedText = fmt(Math.round(shown));
  const big = consumedText.length > 5;

  return (
    <section
      ref={ref}
      aria-labelledby="calorie-heading"
      className="hero-surface relative overflow-hidden rounded-[28px] p-5 text-white shadow-hero sm:p-7">
      
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="calorie-heading" className="truncate text-sm font-semibold text-white/90">
            {date === TODAY ? t('caloriesToday') : t('caloriesOn', { date: formatDay(date) })}
          </h2>
          <p className="truncate text-xs text-white/75">{formatLong(date)}</p>
        </div>
        <button
          type="button"
          onClick={onEditTargets}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors duration-150 hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          
          <TargetIcon className="h-4 w-4" aria-hidden />
          {t('editTargets')}
        </button>
      </div>

      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        <ProgressRing ratio={ratio} className="w-[min(68vw,236px)] shrink-0 sm:w-[220px] lg:w-[240px]">
          <div className="px-6 text-center">
            <p
              className={`font-display font-extrabold leading-none tracking-tight tabular ${big ? 'text-[40px] sm:text-[44px]' : 'text-[54px] sm:text-[58px]'}`}
              aria-hidden>
              
              {consumedText}
            </p>
            <p className="mt-2 text-sm font-medium text-white/85 tabular" aria-hidden>
              / {fmt(target)} {t('kcal')}
            </p>
          </div>
        </ProgressRing>

        <div className="w-full min-w-0 sm:flex-1">
          <div className="rounded-2xl bg-white/[0.14] p-4 ring-1 ring-white/20">
            <p className="text-xs font-semibold text-white/80">{diff >= 0 ? t('remaining') : t('target')}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular sm:text-3xl">
              {diff > 0 && t('kcalLeft', { n: fmt(diff) })}
              {diff === 0 && t('onTarget')}
              {diff < 0 && t('kcalOver', { n: fmt(Math.abs(diff)) })}
            </p>
            {diff < 0 && <p className="mt-1 text-sm text-white/85">{t('overNote')}</p>}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl px-4 py-3 ring-1 ring-white/20">
              <dt className="text-xs font-semibold text-white/80">{t('consumed')}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular">
                {fmt(consumed)} <span className="text-sm font-medium text-white/80">{t('kcal')}</span>
              </dd>
            </div>
            <div className="rounded-2xl px-4 py-3 ring-1 ring-white/20">
              <dt className="text-xs font-semibold text-white/80">{t('target')}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular">
                {fmt(target)} <span className="text-sm font-medium text-white/80">{t('kcal')}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {t('srCalories', { c: fmt(consumed), t: fmt(target), date: formatLong(date) })}{' '}
        {diff >= 0 ? t('kcalLeft', { n: fmt(diff) }) : t('kcalOver', { n: fmt(Math.abs(diff)) })}
      </p>
    </section>);

});
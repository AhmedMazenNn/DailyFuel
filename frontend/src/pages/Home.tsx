import { useEffect, useRef, useState } from 'react';
import { PlusIcon, UtensilsCrossedIcon } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { mealsForDate } from '../utils/nutrition';
import { primaryButton } from '../utils/styles';
import type { Meal } from '../types/nutrition';
import { CalorieHero } from '../components/home/CalorieHero';
import { DateSwitcher } from '../components/home/DateSwitcher';
import { GameStrip } from '../components/home/GameStrip';
import { HomeSkeleton } from '../components/home/HomeSkeleton';
import { MacroCard } from '../components/home/MacroCard';
import { StickyCalorieBar } from '../components/home/StickyCalorieBar';
import { BrandMark } from '../components/layout/BrandMark';
import { MealCard } from '../components/meals/MealCard';
import { MealSheet } from '../components/meals/MealSheet';
import { TargetsSheet } from '../components/targets/TargetsSheet';

export function Home() {
  const { loading, selectedDate, setSelectedDate, meals, getTargets, t, fmt, settings, getTotals } = useApp();
  const [sheet, setSheet] = useState<{open: boolean;meal: Meal | null;}>({ open: false, meal: null });
  const [targetsOpen, setTargetsOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [loading]);

  const dayMeals = mealsForDate(meals, selectedDate);
  const totals = getTotals(selectedDate);
  const targets = getTargets(selectedDate);
  const openAdd = () => setSheet({ open: true, meal: null });

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
        <div className="lg:hidden">
          <BrandMark />
        </div>
        <h1 className="hidden font-display text-3xl font-extrabold tracking-tight lg:block">{t('nav.home')}</h1>
        <div className="sm:w-80">
          <DateSwitcher date={selectedDate} onChange={setSelectedDate} />
        </div>
      </div>

      {loading ?
      <HomeSkeleton /> :

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className="space-y-4 lg:sticky lg:top-10">
            <CalorieHero ref={heroRef} date={selectedDate} consumed={totals.calories} target={targets.calories} onEditTargets={() => setTargetsOpen(true)} />
            <div className="grid grid-cols-2 gap-3">
              <MacroCard kind="protein" consumed={totals.protein} target={targets.protein} />
              <MacroCard kind="fat" consumed={totals.fat} target={targets.fat} />
            </div>
            {settings.showRewards && <GameStrip />}
          </div>

          <section aria-labelledby="meals-heading" className="lg:pt-1">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="meals-heading" className="font-display text-lg font-bold text-ink">
                {t('meals')}
              </h2>
              {dayMeals.length > 0 && <span className="text-sm text-ink-faint tabular">{t('mealsCount', { n: fmt(dayMeals.length) })}</span>}
            </div>

            {dayMeals.length === 0 ?
          <div className="rounded-3xl border border-dashed border-brand-200 bg-white/70 px-6 py-10 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden>
                  <UtensilsCrossedIcon className="h-6 w-6" />
                </span>
                <h3 className="mt-3 font-semibold text-ink">{t('noMealsTitle')}</h3>
                <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">{t('noMealsBody')}</p>
              </div> :

          <ul className="space-y-3">
                {dayMeals.map((m) =>
            <li key={m.id}>
                    <MealCard meal={m} onEdit={(meal) => setSheet({ open: true, meal })} />
                  </li>
            )}
              </ul>
          }

            <button type="button" onClick={openAdd} className={`${primaryButton} mt-4 w-full`}>
              <PlusIcon className="h-5 w-5" aria-hidden />
              {t('addMeal')}
            </button>
          </section>
        </div>
      }

      {!loading &&
      <button
        type="button"
        onClick={openAdd}
        aria-label={t('addMeal')}
        className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] end-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-zest-400 text-ink shadow-float transition-[background-color,transform] duration-150 hover:bg-zest-500 active:scale-95 lg:hidden">
        
          <PlusIcon className="h-6 w-6" strokeWidth={2.5} />
        </button>
      }

      <StickyCalorieBar visible={!loading && !heroVisible} consumed={totals.calories} target={targets.calories} />
      <MealSheet open={sheet.open} meal={sheet.meal} date={selectedDate} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
      <TargetsSheet open={targetsOpen} date={selectedDate} onClose={() => setTargetsOpen(false)} />
    </>);

}
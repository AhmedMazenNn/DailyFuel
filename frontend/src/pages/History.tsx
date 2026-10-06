import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { addDays, TODAY } from '../utils/date';
import { card } from '../utils/styles';
import { DayDetail } from '../components/history/DayDetail';
import { DayRow } from '../components/history/DayRow';
import { WeeklyRecap } from '../components/history/WeeklyRecap';
import { PageHeader } from '../components/ui/PageHeader';

export function History() {
  const { t, loading } = useApp();
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(TODAY, -i)), []);
  const [selected, setSelected] = useState<string | null>(null);
  const desktopSelected = selected ?? addDays(TODAY, -1);

  return (
    <>
      <PageHeader title={t('nav.history')} intro={t('historyIntro')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className={`space-y-4 ${selected ? 'hidden lg:block' : ''}`}>
          <WeeklyRecap />
          <section aria-labelledby="past-days" className={`${card} p-2`}>
            <h2 id="past-days" className="px-3 pb-1 pt-3 font-display text-lg font-bold text-ink">
              {t('pastDays')}
            </h2>
            {loading ?
            <div className="space-y-2 p-2" role="status">
                <span className="sr-only">{t('loading')}</span>
                {[0, 1, 2, 3].map((i) =>
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-canvas" />
              )}
              </div> :

            <ul className="divide-y divide-line/70">
                {days.map((d) =>
              <li key={d} className="py-1">
                    <DayRow date={d} selected={desktopSelected === d} onSelect={setSelected} />
                  </li>
              )}
              </ul>
            }
          </section>
        </div>
        <div className={`${selected ? '' : 'hidden lg:block'} lg:sticky lg:top-10`}>
          <DayDetail date={selected ?? desktopSelected} onBack={() => setSelected(null)} />
        </div>
      </div>
    </>);

}
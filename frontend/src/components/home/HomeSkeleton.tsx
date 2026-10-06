import { useApp } from '../../contexts/AppContext';

export function HomeSkeleton() {
  const { t } = useApp();
  const block = 'animate-pulse rounded-3xl bg-white/70 ring-1 ring-line';
  return (
    <div role="status" aria-live="polite" className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6">
      <span className="sr-only">{t('loading')}</span>
      <div className="space-y-4">
        <div className="h-[420px] animate-pulse rounded-[28px] bg-brand-200/60 sm:h-[300px]" />
        <div className="grid grid-cols-2 gap-3">
          <div className={`${block} h-36`} />
          <div className={`${block} h-36`} />
        </div>
      </div>
      <div className="space-y-3">
        <div className={`${block} h-28`} />
        <div className={`${block} h-28`} />
        <div className={`${block} h-14`} />
      </div>
    </div>);

}
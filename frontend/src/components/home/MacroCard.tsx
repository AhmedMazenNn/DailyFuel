import { motion } from 'framer-motion';
import { useApp } from '../../contexts/AppContext';
import { round1 } from '../../utils/format';

interface MacroCardProps {
  kind: 'protein' | 'fat';
  consumed: number;
  target: number;
}

const STYLES = {
  protein: { bar: 'bg-protein', track: 'bg-protein-soft', ink: 'text-protein-ink' },
  fat: { bar: 'bg-fat', track: 'bg-fat-soft', ink: 'text-fat-ink' }
};

export function MacroCard({ kind, consumed, target }: MacroCardProps) {
  const { t, fmt, reduceMotion } = useApp();
  const s = STYLES[kind];
  const pct = target > 0 ? Math.round(consumed / target * 100) : 0;
  const diff = round1(target - consumed);
  const label = t(kind);

  return (
    <section aria-label={label} className="rounded-3xl bg-white p-4 shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${s.ink}`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.bar}`} aria-hidden />
          <span className="truncate">{label}</span>
        </h3>
        <span className="shrink-0 text-xs font-medium text-ink-faint tabular">{t('ofTarget', { p: fmt(pct) })}</span>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1 font-display tabular">
        <span className="text-2xl font-bold text-ink">{fmt(consumed, 1)}</span>
        <span className="text-sm font-medium text-ink-soft">
          / {fmt(target, 1)} {t('g')}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={consumed}
        className={`mt-3 h-2 overflow-hidden rounded-full ${s.track}`}>
        
        <motion.div
          className={`h-full rounded-full ${s.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.23, 1, 0.32, 1] }} />
        
      </div>
      <p className="mt-2 text-sm font-medium text-ink-soft tabular">
        {diff >= 0 ? t('gLeft', { n: fmt(diff, 1) }) : t('gOver', { n: fmt(Math.abs(diff), 1) })}
      </p>
    </section>);

}
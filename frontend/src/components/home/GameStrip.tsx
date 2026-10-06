import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRightIcon, FlameIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { XP_PER_LEVEL } from '../../utils/gamification';

export function GameStrip() {
  const { stats, t, fmt, reduceMotion } = useApp();
  const prevXp = useRef(stats.xp);
  const [gain, setGain] = useState<number | null>(null);

  useEffect(() => {
    const delta = stats.xp - prevXp.current;
    prevXp.current = stats.xp;
    if (delta <= 0) return;
    setGain(delta);
    const id = setTimeout(() => setGain(null), 1600);
    return () => clearTimeout(id);
  }, [stats.xp]);

  const pct = stats.levelXp / XP_PER_LEVEL * 100;

  return (
    <Link
      to="/profile"
      className="relative flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card ring-1 ring-line transition-shadow duration-150 hover:ring-brand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
      
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-zest-300 text-zest-700" aria-hidden>
          <FlameIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-xl font-bold leading-none text-ink tabular">{fmt(stats.streak)}</p>
          <p className="mt-1 text-xs text-ink-faint">{t('streakDays')}</p>
        </div>
      </div>
      <div className="h-10 w-px bg-line" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{t('level', { n: fmt(stats.level) })}</span>
          <span className="truncate text-xs text-ink-faint tabular">
            {t('xpToNext', { n: fmt(XP_PER_LEVEL - stats.levelXp), l: fmt(stats.level + 1) })}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={stats.levelXp} aria-label={t('level', { n: fmt(stats.level) })}>
          <motion.div
            className="h-full rounded-full bg-zest-500"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.23, 1, 0.32, 1] }} />
          
        </div>
      </div>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-faint rtl:rotate-180" aria-hidden />
      <AnimatePresence>
        {gain &&
        <motion.span
          className="absolute -top-3 end-6 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-zest-300 shadow-float tabular"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
          
            +{fmt(gain)} XP
          </motion.span>
        }
      </AnimatePresence>
    </Link>);

}
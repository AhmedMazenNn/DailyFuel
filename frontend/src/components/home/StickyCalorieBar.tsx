import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../contexts/AppContext';

interface StickyCalorieBarProps {
  visible: boolean;
  consumed: number;
  target: number;
}

export function StickyCalorieBar({ visible, consumed, target }: StickyCalorieBarProps) {
  const { t, fmt, reduceMotion } = useApp();
  const diff = target - consumed;
  const pct = target > 0 ? Math.min(100, consumed / target * 100) : 0;

  return (
    <AnimatePresence>
      {visible &&
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-30 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
        
          <div className="hero-surface mx-auto max-w-xl overflow-hidden rounded-2xl px-4 py-2.5 text-white shadow-hero">
            <div className="flex items-baseline justify-between gap-3 tabular">
              <p className="truncate">
                <span className="font-display text-lg font-extrabold">{fmt(consumed)}</span>
                <span className="text-sm text-white/85">
                  {' '}
                  / {fmt(target)} {t('kcal')}
                </span>
              </p>
              <p className="shrink-0 text-sm font-semibold">
                {diff >= 0 ? t('kcalLeft', { n: fmt(diff) }) : t('kcalOver', { n: fmt(Math.abs(diff)) })}
              </p>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </motion.div>
      }
    </AnimatePresence>);

}
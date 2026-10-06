import React, { useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sheet({ open, onClose, title, subtitle, children, footer }: SheetProps) {
  const { reduceMotion, t } = useApp();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open &&
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
          aria-hidden
          className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose} />
        
          <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative flex max-h-[94dvh] w-full flex-col rounded-t-[28px] bg-white shadow-2xl sm:max-h-[88dvh] sm:max-w-lg sm:rounded-[28px]"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
          transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}>
          
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-6">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-xl font-bold text-ink">
                  {title}
                </h2>
                {subtitle && <p className="mt-0.5 text-sm text-ink-faint">{subtitle}</p>}
              </div>
              <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-canvas text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-ink">
              
                <XIcon className="h-5 w-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">{children}</div>
            {footer &&
          <div className="border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-6">
                {footer}
              </div>
          }
          </motion.div>
        </div>
      }
    </AnimatePresence>);

}
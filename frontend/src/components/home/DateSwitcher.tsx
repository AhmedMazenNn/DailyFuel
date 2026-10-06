import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { addDays } from '../../utils/date';

interface DateSwitcherProps {
  date: string;
  onChange: (date: string) => void;
}

export function DateSwitcher({ date, onChange }: DateSwitcherProps) {
  const { t, formatDay, formatLong } = useApp();
  const btn =
  'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft transition-colors duration-150 hover:bg-brand-50 hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';

  return (
    <div className="flex items-center gap-1 rounded-2xl bg-white/85 p-1 shadow-card ring-1 ring-line backdrop-blur">
      <button type="button" className={btn} aria-label={t('prevDay')} onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeftIcon className="h-5 w-5 rtl:rotate-180" />
      </button>
      <div className="relative min-w-0 flex-1 text-center">
        <span className="block truncate text-sm font-semibold text-ink">{formatDay(date)}</span>
        <span className="block truncate text-xs text-ink-faint">{formatLong(date)}</span>
        <input
          type="date"
          value={date}
          aria-label={t('selectDate')}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        
      </div>
      <button type="button" className={btn} aria-label={t('nextDay')} onClick={() => onChange(addDays(date, 1))}>
        <ChevronRightIcon className="h-5 w-5 rtl:rotate-180" />
      </button>
    </div>);

}
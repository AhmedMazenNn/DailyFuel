import { FlameIcon, TrophyIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

export function BadgeGrid() {
  const { stats, t, fmt } = useApp();
  const badges = [['first', 'badge.first', 'badgeDesc.first', 1], ['seven', 'badge.seven', 'badgeDesc.seven', 7], ['thirty', 'badge.thirty', 'badgeDesc.thirty', 30]] as const;
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{badges.map(([id, title, description, goal]) => {
    const earned = stats.earned.includes(id);
    const Icon = id === 'first' ? TrophyIcon : FlameIcon;
    return <li key={id} className={`rounded-2xl p-3.5 ring-1 ${earned ? 'bg-white ring-zest-400' : 'bg-canvas ring-line'}`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
      <p className="mt-2.5 text-sm font-semibold">{t(title as never)}</p><p className="text-xs text-ink-faint">{t(description as never)}</p>
      <p className="pt-2 text-xs font-semibold">{earned ? t('earned') : `${fmt(stats.loggedDays)} / ${fmt(goal)}`}</p>
    </li>;
  })}</ul>;
}

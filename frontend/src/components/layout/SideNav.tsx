import { NavLink } from 'react-router-dom';
import { FlameIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { BrandMark } from './BrandMark';
import { NAV_ITEMS } from './navItems';

export function SideNav() {
  const { t, fmt, stats, settings } = useApp();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-line bg-white/70 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <BrandMark />
      </div>
      <nav aria-label={t('mainNav')} className="mt-8">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) =>
          <li key={to}>
              <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
              `flex min-h-[48px] items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors duration-150 ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-canvas hover:text-ink'}`

              }>
              
                <Icon className="h-5 w-5" aria-hidden />
                {t(label)}
              </NavLink>
            </li>
          )}
        </ul>
      </nav>
      {settings.showRewards &&
      <div className="mt-auto rounded-2xl bg-canvas p-4 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <FlameIcon className="h-4 w-4 text-zest-700" aria-hidden />
            <span className="text-sm font-semibold text-ink">
              {fmt(stats.streak)} {t('streakDays')}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {t('level', { n: fmt(stats.level) })} · {t('bestStreak', { n: fmt(stats.best) })}
          </p>
        </div>
      }
    </aside>);

}
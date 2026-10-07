import { NavLink } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { NAV_ITEMS } from './navItems';

export function BottomNav() {
  const { t } = useApp();
  return (
    <nav
      aria-label={t('mainNav')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) =>
        <li key={to}>
            <NavLink
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
            `flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition-colors duration-150 ${
            isActive ? 'text-brand-700' : 'text-ink-faint hover:text-ink'}`

            }>
            
              {({ isActive }) =>
            <>
                  <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-150 ${isActive ? 'bg-brand-100' : ''}`}>
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  </span>
                  <span className="max-w-full truncate">{t(label)}</span>
                </>
            }
            </NavLink>
          </li>
        )}
      </ul>
    </nav>);

}
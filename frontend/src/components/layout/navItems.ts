import { AppleIcon, HistoryIcon, HouseIcon, TrendingUpIcon, UserRoundIcon, type LucideIcon } from 'lucide-react';
import type { TKey } from '../../utils/i18n';

export const NAV_ITEMS: {to: string;label: TKey;icon: LucideIcon;}[] = [
{ to: '/', label: 'nav.home', icon: HouseIcon },
{ to: '/history', label: 'nav.history', icon: HistoryIcon },
{ to: '/progress', label: 'nav.progress', icon: TrendingUpIcon },
{ to: '/profile', label: 'nav.profile', icon: UserRoundIcon }];
NAV_ITEMS.splice(3, 0, { to: '/foods', label: 'nav.foods', icon: AppleIcon });

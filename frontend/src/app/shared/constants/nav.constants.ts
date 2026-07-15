export interface NavItemConfig {
  path: string;
  label: string;
  badge?: string;
}

export const MAIN_NAV_ITEMS: NavItemConfig[] = [
  { path: '/dashboard', label: 'Дашборд' },
  { path: '/sales', label: 'Продажи' },
  { path: '/warehouse', label: 'Склад' },
  { path: '/targets', label: 'Цели' },
  { path: '/foodcost', label: 'Фудкост', badge: '3' },
];

export const SECONDARY_NAV_ITEMS: NavItemConfig[] = [
  { path: '/settings', label: 'Настройки' },
  { path: '/support', label: 'Поддержка' },
];

const ALL_NAV_ITEMS = [...MAIN_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/** Заголовок страницы по первому сегменту route (`sales` → «Продажи»). */
export function pageTitleForSegment(segment: string): string | null {
  const item = ALL_NAV_ITEMS.find((nav) => nav.path === `/${segment}`);
  return item?.label ?? null;
}

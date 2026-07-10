export interface NavItemConfig {
  path: string;
  label: string;
  badge?: string;
}

export const MAIN_NAV_ITEMS: NavItemConfig[] = [
  { path: '/dashboard', label: 'Дашборд' },
  { path: '/sales', label: 'Продажи' },
  { path: '/warehouse', label: 'Склад' },
  { path: '/purchases', label: 'Закупки' },
  { path: '/foodcost', label: 'Фудкост', badge: '3' },
];

export const SECONDARY_NAV_ITEMS: NavItemConfig[] = [
  { path: '/settings', label: 'Настройки' },
  { path: '/support', label: 'Поддержка' },
];

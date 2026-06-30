import type { PageName } from '../../shared/models';

export const ALLOWED_PAGES: readonly PageName[] = [
  'dashboard',
  'sales',
  'warehouse',
  'foodcost',
] as const;

export function isAllowedPage(page: string): page is PageName {
  return (ALLOWED_PAGES as readonly string[]).includes(page);
}

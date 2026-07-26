import type { PageName } from '../../shared/models';

/** Страницы, ещё доступные через createPageResource / ApiService.fetchPage. */
export const ALLOWED_PAGES: readonly PageName[] = ['dashboard', 'targets'] as const;

export function isAllowedPage(page: string): page is PageName {
  return (ALLOWED_PAGES as readonly string[]).includes(page);
}

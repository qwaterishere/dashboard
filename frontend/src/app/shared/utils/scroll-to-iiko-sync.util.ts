export const IIKO_SYNC_FRAGMENT = 'iiko-sync';
export const IIKO_SYNC_ANCHOR_ID = IIKO_SYNC_FRAGMENT;

const DEFAULT_OFFSET_PX = 20;
const DEFAULT_MAX_ATTEMPTS = 90;

export function isIikoSyncFragment(fragment: string | null | undefined): boolean {
  return fragment === IIKO_SYNC_FRAGMENT;
}

/** Скролл к блоку загрузки iiko; ждёт появления якоря (async settings). */
export function scrollToIikoSyncAnchor(behavior: ScrollBehavior = 'smooth'): void {
  scrollToElementById(IIKO_SYNC_ANCHOR_ID, { behavior, offsetPx: DEFAULT_OFFSET_PX });
}

function scrollToElementById(
  id: string,
  options: { behavior: ScrollBehavior; offsetPx: number; maxAttempts?: number },
): void {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const attempt = (remaining: number): void => {
    const element = document.getElementById(id);
    if (!element) {
      if (remaining > 0) {
        requestAnimationFrame(() => attempt(remaining - 1));
      }
      return;
    }

    const scrollRoot = element.closest('.app-scroll') as HTMLElement | null;
    if (scrollRoot) {
      const elementTop = element.getBoundingClientRect().top;
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const targetTop = scrollRoot.scrollTop + (elementTop - rootTop) - options.offsetPx;
      scrollRoot.scrollTo({ top: Math.max(0, targetTop), behavior: options.behavior });
    } else {
      element.scrollIntoView({ behavior: options.behavior, block: 'start' });
    }

    element.focus({ preventScroll: true });

    const syncButton = element.querySelector('.sync-actions button') as HTMLButtonElement | null;
    syncButton?.focus({ preventScroll: true });
  };

  attempt(maxAttempts);
}

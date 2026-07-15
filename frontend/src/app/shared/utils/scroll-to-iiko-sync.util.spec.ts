import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollToIikoSyncAnchor } from './scroll-to-iiko-sync.util';

describe('scrollToIikoSyncAnchor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scrolls the app main container with offset', () => {
    const scrollRoot = document.createElement('main');
    scrollRoot.className = 'app-scroll';
    scrollRoot.style.height = '400px';
    scrollRoot.style.overflow = 'auto';
    document.body.appendChild(scrollRoot);

    const anchor = document.createElement('div');
    anchor.id = 'iiko-sync';
    anchor.className = 'sync-block';
    anchor.style.marginTop = '800px';
    scrollRoot.appendChild(anchor);

    Object.defineProperty(scrollRoot, 'scrollTop', { value: 0, writable: true });
    vi.spyOn(scrollRoot, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      right: 0,
      bottom: 400,
      width: 400,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: 240,
      left: 0,
      right: 0,
      bottom: 280,
      width: 400,
      height: 40,
      x: 0,
      y: 240,
      toJSON: () => ({}),
    });

    const scrollTo = vi.fn();
    scrollRoot.scrollTo = scrollTo;

    scrollToIikoSyncAnchor('auto');

    expect(scrollTo).toHaveBeenCalledWith({ top: 220, behavior: 'auto' });
  });
});

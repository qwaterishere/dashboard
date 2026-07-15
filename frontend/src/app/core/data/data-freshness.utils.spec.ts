import { describe, expect, it } from 'vitest';

import type { DataFreshness } from '../../shared/models/data-freshness.model';
import {
  buildFreshnessBanner,
  buildFreshnessBadge,
  lagLabel,
  resolveFreshnessDotTone,
  resolveFreshnessJobSuffix,
  resolveFreshnessUrgency,
} from './data-freshness.utils';

function freshness(partial: Partial<DataFreshness>): DataFreshness {
  return {
    status: 'fresh',
    expectedDay: '2026-03-04',
    latestSalesDay: '2026-03-04',
    lagDays: 0,
    lastSyncAt: null,
    syncStatus: 'idle',
    syncError: null,
    autoSyncEnabled: true,
    syncProgressPercent: null,
    ...partial,
  };
}

describe('resolveFreshnessDotTone', () => {
  it('is green when fresh with no lag', () => {
    expect(resolveFreshnessDotTone(freshness({ status: 'fresh', lagDays: 0 }))).toBe('ok');
  });

  it('is amber on small lag', () => {
    expect(resolveFreshnessDotTone(freshness({ status: 'stale', lagDays: 1 }))).toBe('warn');
  });

  it('is red on severe lag', () => {
    expect(resolveFreshnessDotTone(freshness({ status: 'stale', lagDays: 4 }))).toBe('critical');
  });
});

describe('resolveFreshnessJobSuffix', () => {
  it('shows sync arrow while syncing', () => {
    expect(resolveFreshnessJobSuffix(freshness({ status: 'syncing' }))).toBe('sync');
  });

  it('shows action mark on error', () => {
    expect(resolveFreshnessJobSuffix(freshness({ status: 'error' }))).toBe('action');
  });

  it('has no suffix for pending autosync', () => {
    expect(resolveFreshnessJobSuffix(freshness({ status: 'stale', lagDays: 1 }))).toBeNull();
  });
});

describe('buildFreshnessBadge', () => {
  it('shows iiko date label without suffix when fresh', () => {
    const view = buildFreshnessBadge(
      freshness({ status: 'fresh', latestSalesDay: '2026-03-04' }),
    );
    expect(view.dotTone).toBe('ok');
    expect(view.label).toMatch(/^iiko · /);
    expect(view.label).not.toContain('· ↻');
    expect(view.label).not.toContain('· !');
  });

  it('combines amber dot, iiko date and sync suffix', () => {
    const view = buildFreshnessBadge(
      freshness({
        status: 'syncing',
        latestSalesDay: '2026-03-03',
        lagDays: 1,
        syncProgressPercent: 40,
      }),
    );
    expect(view.dotTone).toBe('warn');
    expect(view.label).toContain('· ↻');
    expect(view.pulsing).toBe(true);
  });

  it('combines dot and action suffix on error', () => {
    const view = buildFreshnessBadge(
      freshness({
        status: 'error',
        latestSalesDay: '2026-03-03',
        lagDays: 1,
        syncError: 'timeout',
      }),
    );
    expect(view.dotTone).toBe('warn');
    expect(view.label).toContain('· !');
  });

  it('shows red dot on severe lag with iiko date label', () => {
    const view = buildFreshnessBadge(
      freshness({ status: 'stale', latestSalesDay: '2026-02-28', lagDays: 4 }),
    );
    expect(view.dotTone).toBe('critical');
    expect(view.label).toMatch(/^iiko · /);
  });
});

describe('buildFreshnessBanner (D)', () => {
  it('hides when fresh', () => {
    expect(buildFreshnessBanner(freshness({ status: 'fresh' })).visible).toBe(false);
  });

  it('hides when syncing (badge only)', () => {
    expect(buildFreshnessBanner(freshness({ status: 'syncing' })).visible).toBe(false);
  });

  it('hides when stale with autosync pending', () => {
    expect(
      buildFreshnessBanner(
        freshness({ status: 'stale', latestSalesDay: '2026-03-03', lagDays: 1 }),
      ).visible,
    ).toBe(false);
  });

  it('shows on action_required error', () => {
    const view = buildFreshnessBanner(freshness({ status: 'error', syncError: 'timeout' }));
    expect(view.visible).toBe(true);
    expect(view.message).toContain('timeout');
  });

  it('shows on critical lag', () => {
    const view = buildFreshnessBanner(
      freshness({ status: 'stale', latestSalesDay: '2026-02-28', lagDays: 4 }),
    );
    expect(view.visible).toBe(true);
    expect(view.tone).toBe('error');
    expect(view.message).toContain('сильно устарели');
  });
});

describe('resolveFreshnessUrgency', () => {
  it('classifies pending stale separately from action', () => {
    expect(resolveFreshnessUrgency(freshness({ status: 'stale', lagDays: 1 }))).toBe('pending');
    expect(resolveFreshnessUrgency(freshness({ status: 'stale_manual', lagDays: 1 }))).toBe(
      'action_required',
    );
  });
});

describe('lagLabel', () => {
  it('declines day count in ru', () => {
    expect(lagLabel(1)).toBe('1 день');
    expect(lagLabel(2)).toBe('2 дня');
    expect(lagLabel(5)).toBe('5 дней');
  });
});

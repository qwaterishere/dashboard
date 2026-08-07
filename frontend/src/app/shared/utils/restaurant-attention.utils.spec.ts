import { describe, expect, it } from 'vitest';

import type { AttentionApi } from '../models/attention.model';
import type { DataFreshness } from '../models/data-freshness.model';
import {
  attentionDomainsReady,
  buildOperationalAttentionItemsFromApi,
  buildRestaurantAttentionVm,
  formatLastSyncAt,
  navAttentionBadgeCounts,
  sortAttentionItems,
} from './restaurant-attention.utils';

function freshness(partial: Partial<DataFreshness> = {}): DataFreshness {
  const { stock: stockPartial, ...rest } = partial;
  return {
    status: 'fresh',
    expectedDay: '2026-07-22',
    latestSalesDay: '2026-07-22',
    lagDays: 0,
    lastSyncAt: '2026-07-23T10:00:00.000Z',
    syncStatus: 'success',
    syncError: null,
    autoSyncEnabled: true,
    syncProgressPercent: null,
    syncPhase: null,
    ...rest,
    stock: {
      latestDay: '2026-07-22',
      lagDays: 0,
      syncStatus: 'success',
      syncError: null,
      daysDone: null,
      ...(stockPartial ?? {}),
    },
  };
}

function attention(partial: Partial<AttentionApi> = {}): AttentionApi {
  const { domains: domainPartial, ...rest } = partial;
  return {
    asOf: '2026-07-22',
    period: { year: 2026, month: 7 },
    domains: {
      stock: 'ready',
      foodcost: 'ready',
      revenue: 'ready',
      targets: 'ready',
      ...(domainPartial ?? {}),
    },
    negativeStock: { count: 0, valueAbs: 0 },
    foodcost: {
      cleanPct: 25,
      cleanGoal: 28,
      cleanGoalConfigured: true,
      overGoal: false,
      complimentsFact: 0,
      complimentsGoal: 1000,
      complimentsOver: false,
    },
    revenuePace: { risk: false, fact: 100, pace: 100 },
    monthPlan: { configured: true },
    ...rest,
  };
}

describe('formatLastSyncAt', () => {
  it('formats relative minutes', () => {
    const now = Date.parse('2026-07-23T10:15:00.000Z');
    const view = formatLastSyncAt('2026-07-23T10:00:00.000Z', now);
    expect(view?.relative).toMatch(/15/);
  });
});

describe('buildOperationalAttentionItemsFromApi', () => {
  it('flags negative stock as P0 critical with warehouse deep-link', () => {
    const items = buildOperationalAttentionItemsFromApi(
      attention({
        negativeStock: { count: 3, valueAbs: 12_400 },
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe('negative-stock');
    expect(items[0]!.title).toBe('Минусовые остатки');
    expect(items[0]!.detail).toMatch(/3 поз/);
    expect(items[0]!.actionLabel).toBe('К складу');
    expect(items[0]!.severity).toBe('critical');
    expect(items[0]!.link).toBe('/warehouse');
    expect(items[0]!.queryParams).toEqual({ focus: 'negative' });
  });

  it('uses server overGoal flag without client threshold', () => {
    const items = buildOperationalAttentionItemsFromApi(
      attention({
        foodcost: {
          cleanPct: 32,
          cleanGoal: 28,
          cleanGoalConfigured: true,
          overGoal: true,
          complimentsFact: 100,
          complimentsGoal: 4000,
          complimentsOver: false,
        },
      }),
    );
    expect(items.find((i) => i.id === 'foodcost-over')?.title).toBe('Фудкост выше цели');
  });

  it('skips foodcost when overGoal is false even if pct looks high', () => {
    const items = buildOperationalAttentionItemsFromApi(
      attention({
        foodcost: {
          cleanPct: 40,
          cleanGoal: 28,
          cleanGoalConfigured: false,
          overGoal: false,
          complimentsFact: 0,
          complimentsGoal: 0,
          complimentsOver: false,
        },
      }),
    );
    expect(items.some((i) => i.id === 'foodcost-over')).toBe(false);
  });

  it('pace copy uses expectations not plan', () => {
    const items = buildOperationalAttentionItemsFromApi(
      attention({
        revenuePace: { risk: true, fact: 90, pace: 100 },
      }),
    );
    const pace = items.find((i) => i.id === 'revenue-pace');
    expect(pace?.detail).toMatch(/ожиданий на сегодня/);
    expect(pace?.detail).not.toMatch(/план/);
  });

  it('is empty when flags clear', () => {
    expect(buildOperationalAttentionItemsFromApi(attention())).toEqual([]);
  });
});

describe('sortAttentionItems', () => {
  it('ranks negative stock above sales lag of same severity', () => {
    const items = sortAttentionItems([
      {
        id: 'sales-lag',
        severity: 'critical',
        title: 'lag',
        detail: null,
        message: 'lag',
        actionLabel: null,
        actionKind: 'sync',
        link: null,
        fragment: null,
        priority: 2,
      },
      {
        id: 'negative-stock',
        severity: 'critical',
        title: 'stock',
        detail: null,
        message: 'stock',
        actionLabel: null,
        actionKind: 'link',
        link: '/warehouse',
        fragment: null,
        queryParams: { focus: 'negative' },
        priority: 0,
      },
    ]);
    expect(items[0]!.id).toBe('negative-stock');
  });
});

describe('attentionDomainsReady', () => {
  it('true for ready/empty/insufficient', () => {
    expect(
      attentionDomainsReady(
        attention({
          domains: {
            stock: 'empty',
            foodcost: 'ready',
            revenue: 'insufficient',
            targets: 'ready',
          },
        }),
      ),
    ).toBe(true);
  });

  it('false for error', () => {
    expect(
      attentionDomainsReady(
        attention({
          domains: {
            stock: 'error',
            foodcost: 'ready',
            revenue: 'ready',
            targets: 'ready',
          },
        }),
      ),
    ).toBe(false);
  });
});

describe('buildRestaurantAttentionVm', () => {
  it('shows clean ok only when domains ready and no items', () => {
    const vm = buildRestaurantAttentionVm({
      attention: attention(),
      freshness: freshness(),
      freshnessLoading: false,
      freshnessLoadError: false,
    });
    expect(vm.items).toEqual([]);
    expect(vm.domainsReady).toBe(true);
    expect(vm.summaryLabel).toBe('');
    expect(vm.attentionOkMessage).toBe('Критичных отклонений нет');
    expect(vm.trust?.expanded).toBe(false);
    expect(vm.trust?.compactLabel).toMatch(/Актуально на/);
  });

  it('does not put freshness lag into ranked operational list', () => {
    const vm = buildRestaurantAttentionVm({
      attention: attention({
        negativeStock: { count: 2, valueAbs: 5000 },
      }),
      freshness: freshness({ status: 'stale', lagDays: 2 }),
      freshnessLoading: false,
      freshnessLoadError: false,
    });
    expect(vm.items.map((i) => i.id)).toEqual(['negative-stock']);
    expect(vm.trust?.expanded).toBe(true);
  });

  it('does not claim domains ready while attention loading', () => {
    const vm = buildRestaurantAttentionVm({
      attention: null,
      attentionLoading: true,
      freshness: freshness(),
      freshnessLoading: false,
      freshnessLoadError: false,
    });
    expect(vm.domainsReady).toBe(false);
    expect(vm.loading).toBe(true);
  });

  it('expands trust strip when stale', () => {
    const vm = buildRestaurantAttentionVm({
      attention: attention(),
      freshness: freshness({ status: 'stale', lagDays: 1 }),
      freshnessLoading: false,
      freshnessLoadError: false,
    });
    expect(vm.trust?.expanded).toBe(true);
    expect(vm.trust?.cta.kind).toBe('sync');
  });

  it('disables sync CTA while syncBusy', () => {
    const vm = buildRestaurantAttentionVm({
      attention: attention(),
      freshness: freshness(),
      freshnessLoading: false,
      freshnessLoadError: false,
      syncBusy: true,
    });
    expect(vm.trust?.cta.disabled).toBe(true);
    expect(vm.trust?.expanded).toBe(true);
  });

  it('shows retry on freshness load error', () => {
    const vm = buildRestaurantAttentionVm({
      attention: null,
      freshness: null,
      freshnessLoading: false,
      freshnessLoadError: true,
    });
    expect(vm.loadError).toBe(true);
    expect(vm.trust?.cta.kind).toBe('retry');
  });
});

describe('navAttentionBadgeCounts', () => {
  it('returns empty map when attention is null', () => {
    expect(navAttentionBadgeCounts(null)).toEqual({});
  });

  it('counts operational items by nav path', () => {
    expect(
      navAttentionBadgeCounts(
        attention({
          negativeStock: { count: 2, valueAbs: 1000 },
          foodcost: {
            cleanPct: 32,
            cleanGoal: 30,
            cleanGoalConfigured: true,
            overGoal: true,
            complimentsFact: 50_000,
            complimentsGoal: 40_000,
            complimentsOver: true,
          },
          revenuePace: { risk: true, fact: 90, pace: 100 },
          monthPlan: { configured: false },
        }),
      ),
    ).toEqual({
      '/warehouse': 1,
      '/foodcost': 2,
      '/dashboard': 1,
      '/targets': 1,
    });
  });

  it('omits paths with no attention', () => {
    expect(navAttentionBadgeCounts(attention())).toEqual({});
  });
});

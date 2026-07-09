import type { DashboardV2 } from '../../../shared/models/dashboard-v2.model';
import type { WarehouseData } from '../../../shared/models/warehouse.model';
import { buildDashboardViewModel, buildStockFromWarehouse } from './dashboard-v2.utils';

const sample: DashboardV2 = {
  period: { year: 2026, month: 6, dayFrom: 1, dayTo: 11 },
  compare: { year: 2025, month: 6, dayFrom: 1, dayTo: 11 },
  kpis: {
    revenue: { value: 1000, prevValue: 800, forecast: 5000 },
    checks: { value: 10, prevValue: 8, forecast: 50 },
    guests: { value: 20, prevValue: 18, forecast: 100 },
    avgCheck: { value: 100, prevValue: 90, forecast: 110 },
  },
  revenueByDay: [
    { day: 1, weekday: 1, revenue: 500, checks: 5, guests: 10, plan: null },
  ],
  units: [
    { key: 'k', revenue: 600, cost: 200, prevRevenue: 500, prevCost: 180 },
    { key: 'b', revenue: 400, cost: 100, prevRevenue: 300, prevCost: 90 },
    { key: 'w', revenue: 0, cost: 0, prevRevenue: 0, prevCost: 0 },
    { key: 'o', revenue: 0, cost: 0, prevRevenue: 0, prevCost: 0 },
  ],
  reviews: null,
  stock: null,
};

const warehouseSample: WarehouseData = {
  asOf: { label: '11 июня', note: '' },
  totals: {
    value: 799970,
    stores: 3,
    byStore: [
      { key: 'k', name: 'Кухня', value: 264530 },
      { key: 'b', name: 'Бар', value: 226640 },
      { key: 'w', name: 'Вино', value: 308800 },
    ],
  },
  positions: [],
  dynamics: {
    all: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    k: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    b: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    w: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    o: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
  },
};

describe('dashboard-v2.utils', () => {
  it('builds view model with LfL and foodcost from v2 facts', () => {
    const vm = buildDashboardViewModel(sample);
    expect(vm.kpis.revenue.lfl?.pct).toBe(25);
    expect(vm.foodcostMini.items).toHaveLength(3);
    expect(vm.categories).toHaveLength(2);
    expect(vm.reviews).toBeNull();
    expect(vm.stock).toBeNull();
    expect(vm.revenueByDay[0].plan).toBeNull();
    expect(vm.chartPeriod).toEqual(sample.period);
  });

  it('filters chart days for week granularity', () => {
    const extended: DashboardV2 = {
      ...sample,
      revenueByDay: Array.from({ length: 11 }, (_, i) => ({
        day: i + 1,
        weekday: 1,
        revenue: 100,
        checks: 1,
        guests: 1,
        plan: null,
      })),
    };
    const vm = buildDashboardViewModel(extended, { granularity: 'week' });
    expect(vm.revenueByDay).toHaveLength(7);
  });

  it('builds stock panel from warehouse stub', () => {
    const stock = buildStockFromWarehouse(warehouseSample);
    expect(stock.total).toBe(799970);
    expect(stock.items).toHaveLength(3);
  });
});

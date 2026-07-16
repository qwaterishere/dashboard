import type { DashboardApi } from '../../../shared/models/dashboard-api.model';
import type { FoodcostApi } from '../../../shared/models/foodcost-api.model';
import type { WarehouseData } from '../../../shared/models/warehouse.model';
import { buildDashboardViewModel, buildStockFromWarehouse } from './dashboard.mapper';

const sample: DashboardApi = {
  period: { year: 2026, month: 6, dayFrom: 1, dayTo: 11 },
  compare: { year: 2026, month: 5, dayFrom: 1, dayTo: 11 },
  dataBounds: { earliest: '2026-01-01', latest: '2026-06-11' },
  kpis: {
    revenue: { value: 1000, prevValue: 800, forecast: 5000, forecastToday: 1200 },
    checks: { value: 10, prevValue: 8, forecast: 50, forecastToday: 12 },
    guests: { value: 20, prevValue: 18, forecast: 100, forecastToday: 22 },
    avgCheck: { value: 100, prevValue: 90, forecast: 110, forecastToday: 100 },
  },
  revenueByDay: [
    { day: 1, weekday: 1, revenue: 500, checks: 5, guests: 10, plan: null, forecast: null },
  ],
  revenueByMonth: [{ month: 6, revenue: 500, checks: 5, guests: 10, plan: null, forecast: null }],
  units: [
    { key: 'k', revenue: 600, cost: 200, prevRevenue: 500, prevCost: 180 },
    { key: 'b', revenue: 400, cost: 100, prevRevenue: 300, prevCost: 90 },
    { key: 'w', revenue: 0, cost: 0, prevRevenue: 0, prevCost: 0 },
    { key: 'o', revenue: 0, cost: 0, prevRevenue: 0, prevCost: 0 },
  ],
  reviews: null,
  stock: null,
};

const foodcostSample: FoodcostApi = {
  period: sample.period,
  compare: sample.compare,
  totals: {
    revenue: 1000,
    cost: 300,
    revenueWithCost: 1000,
    prevRevenue: 800,
    prevCost: 250,
    prevRevenueWithCost: 800,
    goal: null,
  },
  dirty: null,
  units: [
    {
      key: 'k',
      revenue: 600,
      cost: 200,
      revenueWithCost: 600,
      prevRevenue: 500,
      prevCost: 180,
      prevRevenueWithCost: 500,
    },
    {
      key: 'b',
      revenue: 400,
      cost: 100,
      revenueWithCost: 400,
      prevRevenue: 300,
      prevCost: 90,
      prevRevenueWithCost: 300,
    },
    {
      key: 'w',
      revenue: 0,
      cost: 0,
      revenueWithCost: 0,
      prevRevenue: 0,
      prevCost: 0,
      prevRevenueWithCost: 0,
    },
    {
      key: 'o',
      revenue: 0,
      cost: 0,
      revenueWithCost: 0,
      prevRevenue: 0,
      prevCost: 0,
      prevRevenueWithCost: 0,
    },
  ],
  groups: [],
  products: [],
  discounts: {
    discountSum: 0,
    discountedRevenue: 0,
    discountedRevenueWithCost: 0,
    discountSumWithCost: 0,
    discountedCost: 0,
  },
  losses: {
    compliments: { cost: 0, priceValue: 0, qty: 0 },
    staff: { cost: 0, paidSum: 0, qty: 0 },
    writeoffs: null,
  },
};

const warehouseSample: WarehouseData = {
  asOf: { label: '11 июня', note: 'слепок на конец дня', iso: '2026-06-11' },
  dataBounds: {
    earliest: '2026-06-01',
    latest: '2026-06-11',
    availableDates: ['2026-06-11'],
  },
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
  negativeStock: { count: 0, valueAbs: 0 },
  dynamics: {
    all: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    k: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    b: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    w: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
    o: { week: { labels: [], values: [] }, month: { labels: [], values: [] } },
  },
};

describe('dashboard.mapper', () => {
  it('builds view model with LfL and foodcost from API facts', () => {
    const vm = buildDashboardViewModel(sample);
    expect(vm.kpis.revenue.lfl?.pct).toBe(25);
    expect(vm.foodcostMini.items).toHaveLength(3);
    expect(vm.categories).toHaveLength(2);
    expect(vm.reviews).toBeNull();
    expect(vm.stock).toBeNull();
    expect(vm.revenueByDay[0].plan).toBeNull();
    expect(vm.chartPeriod).toEqual(sample.period);
  });

  it('prefers foodcost API for mini panel fc%', () => {
    const vm = buildDashboardViewModel(sample, { foodcost: foodcostSample });
    expect(vm.foodcostMini.items[0].pct).toBeCloseTo(33.3, 1);
    expect(vm.categories).toEqual([
      { key: 'k', name: 'Кухня', pct: 60 },
      { key: 'b', name: 'Бар', pct: 40 },
    ]);
  });

  it('maps guests card with checks as headline and guests in subline', () => {
    const vm = buildDashboardViewModel(sample);
    expect(vm.kpis.guests.value).toBe(10);
    expect(vm.kpis.guests.guests).toBe(20);
    expect(vm.kpis.guests.lfl?.pct).toBe(25);
  });

  it('filters chart days for week granularity', () => {
    const extended: DashboardApi = {
      ...sample,
      revenueByDay: Array.from({ length: 11 }, (_, i) => ({
        day: i + 1,
        weekday: 1,
        revenue: 100,
        checks: 1,
        guests: 1,
        plan: null, forecast: null,
      })),
    };
    const vm = buildDashboardViewModel(extended, { granularity: 'week' });
    expect(vm.revenueByDay).toHaveLength(7);
    expect(vm.revenueByDay[0].day).toBe(8);
    expect(vm.revenueByDay[6].day).toBe(14);
  });

  it('filters chart days for selected week range', () => {
    const extended: DashboardApi = {
      ...sample,
      revenueByDay: Array.from({ length: 11 }, (_, i) => ({
        day: i + 1,
        weekday: 1,
        revenue: 100,
        checks: 1,
        guests: 1,
        plan: null, forecast: null,
      })),
    };
    const vm = buildDashboardViewModel(extended, {
      granularity: 'week',
      weekRange: { startDate: '2026-06-01', endDate: '2026-06-07' },
    });
    expect(vm.revenueByDay).toHaveLength(7);
    expect(vm.revenueByDay[0].day).toBe(1);
    expect(vm.revenueByDay[6].day).toBe(7);
  });

  it('uses monthly series for year granularity with month display', () => {
    const extended: DashboardApi = {
      ...sample,
      revenueByMonth: [
        { month: 1, revenue: 100, checks: 1, guests: 2, plan: null, forecast: null },
        { month: 2, revenue: 200, checks: 2, guests: 4, plan: null, forecast: null },
      ],
    };
    const vm = buildDashboardViewModel(extended, { granularity: 'year', chartDisplayMode: 'month' });
    expect(vm.chartDisplayMode).toBe('month');
    expect(vm.revenueByDay).toHaveLength(12);
    expect(vm.revenueByDay[1].day).toBe(2);
    expect(vm.revenueByDay[1].revenue).toBe(200);
    expect(vm.revenueByDay[11].revenue).toBe(0);
  });

  it('aggregates year data into quarters', () => {
    const extended: DashboardApi = {
      ...sample,
      revenueByMonth: [
        { month: 1, revenue: 100, checks: 1, guests: 2, plan: null, forecast: null },
        { month: 4, revenue: 200, checks: 2, guests: 4, plan: null, forecast: null },
      ],
    };
    const vm = buildDashboardViewModel(extended, { granularity: 'year', chartDisplayMode: 'quarter' });
    expect(vm.revenueByDay).toHaveLength(4);
    expect(vm.revenueByDay[0].revenue).toBe(100);
    expect(vm.revenueByDay[1].revenue).toBe(200);
  });

  it('uses year forecast label for year granularity', () => {
    const monthVm = buildDashboardViewModel(sample, { granularity: 'month' });
    const yearVm = buildDashboardViewModel(sample, { granularity: 'year' });
    expect(monthVm.kpis.revenue.forecast.label).toBe('Прогноз на конец месяца');
    expect(yearVm.kpis.revenue.forecast.label).toBe('Прогноз на конец года');
    expect(yearVm.details['rev-goal'].rows[1]?.[0]).toBe('Ожидание на сегодня');
    expect(yearVm.details['rev-goal'].rows[2]?.[0]).toBe('Прогноз на конец года');
  });

  it('switches revenue KPI labels to plan when day plans present', () => {
    const withPlan: DashboardApi = {
      ...sample,
      revenueByDay: sample.revenueByDay.map((day, index) =>
        index === 0 ? { ...day, plan: 100_000 } : day,
      ),
    };
    const vm = buildDashboardViewModel(withPlan, { granularity: 'month' });
    expect(vm.kpis.revenue.forecast.label).toBe('План на конец месяца');
    expect(vm.details['rev-goal'].title).toBe('План — выручка');
    expect(vm.details['rev-goal'].rows[2]?.[0]).toBe('План на конец месяца');
  });

  it('marks planPct from forecastToday and risks when behind pace by >2%', () => {
    const vm = buildDashboardViewModel(sample, { granularity: 'month' });
    // 1200/5000 = 24%
    expect(vm.kpis.revenue.forecast.planPct).toBe(24);
    // 1000 < 1200 * 0.98 → risk
    expect(vm.kpis.revenue.forecast.risk).toBe(true);

    const onPace: DashboardApi = {
      ...sample,
      kpis: {
        ...sample.kpis,
        revenue: { value: 1200, prevValue: 800, forecast: 5000, forecastToday: 1200 },
      },
    };
    const ok = buildDashboardViewModel(onPace, { granularity: 'month' });
    expect(ok.kpis.revenue.forecast.risk).toBe(false);
  });

  it('builds stock panel from warehouse view-model', () => {
    const stock = buildStockFromWarehouse(warehouseSample);
    expect(stock.total).toBe(799970);
    expect(stock.items).toHaveLength(3);
  });
});

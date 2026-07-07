import type { DashboardV2 } from '../../../shared/models/dashboard-v2.model';
import { buildDashboardViewModel } from './dashboard-v2.utils';

const sample: DashboardV2 = {
  period: { year: 2026, month: 6, dayFrom: 1, dayTo: 11 },
  compare: { year: 2025, month: 6, dayFrom: 1, dayTo: 11 },
  kpis: {
    revenue: { value: 1000, prev: 800, forecast: 5000 },
    checks: { value: 10, prev: 8, forecast: 50 },
    guests: { value: 20, prev: 18, forecast: 100 },
    avgCheck: { value: 100, prev: 90, forecast: 110 },
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

describe('dashboard-v2.utils', () => {
  it('builds view model with LfL and foodcost from v2 facts', () => {
    const vm = buildDashboardViewModel(sample);
    expect(vm.kpis.revenue.lfl?.pct).toBe(25);
    expect(vm.foodcostMini.items).toHaveLength(3);
    expect(vm.categories).toHaveLength(2);
    expect(vm.reviews).toBeNull();
    expect(vm.stock).toBeNull();
  });
});

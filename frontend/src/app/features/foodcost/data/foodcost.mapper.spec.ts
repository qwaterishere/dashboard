import type { FoodcostApi } from '../../../shared/models/foodcost-api.model';
import { buildFoodcostViewModel, buildDashboardFoodcostMini } from './foodcost.mapper';

const sample: FoodcostApi = {
  period: { year: 2026, month: 6, dayFrom: 1, dayTo: 10 },
  compare: { year: 2026, month: 5, dayFrom: 1, dayTo: 10 },
  totals: {
    revenue: 1780,
    cost: 348,
    revenueWithCost: 1280,
    prevRevenue: 400,
    prevCost: 100,
    prevRevenueWithCost: 400,
    goal: null,
  },
  dirty: null,
  units: [
    {
      key: 'k',
      revenue: 1500,
      cost: 300,
      revenueWithCost: 1000,
      prevRevenue: 400,
      prevCost: 100,
      prevRevenueWithCost: 400,
      goal: 28,
    },
    {
      key: 'b',
      revenue: 280,
      cost: 48,
      revenueWithCost: 280,
      prevRevenue: 0,
      prevCost: 0,
      prevRevenueWithCost: 0,
      goal: 22,
    },
    {
      key: 'w',
      revenue: 0,
      cost: 0,
      revenueWithCost: 0,
      prevRevenue: 0,
      prevCost: 0,
      prevRevenueWithCost: 0,
      goal: null,
    },
    {
      key: 'o',
      revenue: 0,
      cost: 0,
      revenueWithCost: 0,
      prevRevenue: 0,
      prevCost: 0,
      prevRevenueWithCost: 0,
      goal: null,
    },
  ],
  groups: [
    {
      unit: 'k',
      group: 'Горячее',
      revenue: 1000,
      cost: 300,
      revenueWithCost: 1000,
      prevRevenue: 400,
      prevCost: 100,
      prevRevenueWithCost: 400,
    },
    {
      unit: 'b',
      group: 'Кофе',
      revenue: 280,
      cost: 48,
      revenueWithCost: 280,
      prevRevenue: 0,
      prevCost: 0,
      prevRevenueWithCost: 0,
    },
  ],
  products: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Стейк',
      unit: 'k',
      qty: 10,
      revenue: 1000,
      cost: 300,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Лимонад',
      unit: 'b',
      qty: 20,
      revenue: 280,
      cost: 180,
    },
  ],
  discounts: {
    discountSum: 70,
    discountedRevenue: 280,
    discountedRevenueWithCost: 280,
    discountSumWithCost: 70,
    discountedCost: 48,
  },
  losses: {
    compliments: { cost: 150, priceValue: 520, qty: 1 },
    staff: { cost: 0, paidSum: 0, qty: 0 },
    writeoffs: null,
    writeoffsGoal: 12000,
    complimentsGoal: 4000,
  },
};

describe('foodcost.mapper', () => {
  it('builds clean and dirty overview from totals + losses', () => {
    const vm = buildFoodcostViewModel(sample);
    expect(vm.overview.clean.pct).toBeCloseTo(27.19, 1);
    expect(vm.overview.clean.cost).toBe(348);
    expect(vm.overview.clean.revenue).toBe(1780);

    // dirty = (348 + 150 compliments) / 1280
    expect(vm.overview.dirty.title).toBe('Фудкост с учётом потерь');
    expect(vm.overview.dirty.overSales).toBe(150);
    expect(vm.overview.dirty.cost).toBe(498);
    expect(vm.overview.dirty.pct).toBeCloseTo(38.91, 1);
  });

  it('maps units, categories and losses for phase 1', () => {
    const vm = buildFoodcostViewModel(sample);
    expect(vm.units).toHaveLength(3);
    expect(vm.units[0].key).toBe('k');
    expect(vm.categories.k).toHaveLength(1);
    expect(vm.categories.k[0].name).toBe('Горячее');
    expect(vm.losses.rows).toHaveLength(3);
    expect(vm.losses.rows[2].fact).toBe(150);
    expect(vm.products).toHaveLength(2);
    expect(vm.products[0].name).toBe('Стейк');
    expect(vm.products[0].price).toBe(100);
    expect(vm.products[0].cost).toBe(30);
    expect(vm.products[1].group).toBe('b');
  });

  it('formats discount impact cells', () => {
    const vm = buildFoodcostViewModel(sample);
    expect(vm.discounts[0].value).toContain('70');
    expect(vm.discounts[1].value).toContain('%');
    expect(vm.discounts[2].tone).toBe('amber');
  });

  it('builds dashboard foodcost mini from API units', () => {
    const mini = buildDashboardFoodcostMini(sample.units);
    expect(mini.items).toHaveLength(3);
    expect(mini.items[0].pct).toBeCloseTo(30, 0);
    expect(mini.items[1].pct).toBeCloseTo(17.1, 0);
    expect(mini.items[0].goal).toBe(28);
    expect(mini.items[1].goal).toBe(22);
  });

  it('uses targets goals for units and losses', () => {
    const vm = buildFoodcostViewModel(sample);
    expect(vm.units[0].goal).toBe(28);
    expect(vm.losses.rows[0].goal).toBe(12000);
    expect(vm.losses.rows[2].goal).toBe(4000);
  });
});

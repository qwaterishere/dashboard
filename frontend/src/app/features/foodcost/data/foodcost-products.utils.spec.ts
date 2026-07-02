import type { FoodcostProduct } from '../../../shared/models';
import {
  buildProductChartBars,
  computeProductChartItems,
} from './foodcost-products.utils';

const sample: FoodcostProduct[] = [
  { name: 'A', group: 'k', price: 100, cost: 30 },
  { name: 'B', group: 'k', price: 200, cost: 120 },
  { name: 'C', group: 'b', price: 150, cost: 60 },
];

describe('foodcost-products.utils', () => {
  it('computes foodcost percent and margin', () => {
    const items = computeProductChartItems(sample);
    expect(items[0].fc).toBe(30);
    expect(items[0].margin).toBe(70);
  });

  it('builds good and bad bar sets from sorted fc', () => {
    const items = computeProductChartItems(sample);
    const bars = buildProductChartBars(items, 'all');
    expect(bars.good.length).toBeLessThanOrEqual(10);
    expect(bars.bad.length).toBeLessThanOrEqual(10);
    expect(bars.good[0].fc).toBeLessThanOrEqual(bars.bad[0].fc);
  });

  it('filters by group', () => {
    const items = computeProductChartItems(sample);
    const bars = buildProductChartBars(items, 'b');
    expect(bars.good.every((b) => b.name === 'C' || bars.good.length === 1)).toBe(true);
  });
});

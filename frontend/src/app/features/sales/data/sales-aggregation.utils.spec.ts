import {
  buildBarGroups,
  buildDonutSlices,
  computeSalesRaw,
  barChartScale,
} from './sales-aggregation.utils';
import { CAT_COLOR } from '../../../shared/constants/category.constants';
import type { SalesPosition } from '../../../shared/models';

const sample: SalesPosition[] = [
  { name: 'A', sub: 'Hot', cat: 'k', qty: 10, price: 100, unitCost: 40 },
  { name: 'B', sub: 'Hot', cat: 'k', qty: 5, price: 200, unitCost: 80 },
  { name: 'C', sub: 'Cocktail', cat: 'b', qty: 8, price: 300, unitCost: 90 },
];

describe('sales-aggregation.utils', () => {
  it('computes revenue, gp and foodcost from raw position fields', () => {
    const raw = computeSalesRaw(sample);
    expect(raw[0].rev).toBe(1000);
    expect(raw[0].gp).toBe(600);
    expect(raw[0].fc).toBe(40);
  });

  it('builds donut slices for categories with revenue', () => {
    const raw = computeSalesRaw(sample);
    const slices = buildDonutSlices(raw, CAT_COLOR);
    expect(slices).toHaveLength(2);
    expect(slices[0].rev).toBe(2000);
  });

  it('builds subcategory bar groups sorted by revenue', () => {
    const raw = computeSalesRaw(sample);
    const groups = buildBarGroups(raw, 'sub');
    expect(groups.find((g) => g.category === 'k')?.rows[0].name).toBe('Hot');
  });

  it('returns bar chart scale from groups', () => {
    const raw = computeSalesRaw(sample);
    const groups = buildBarGroups(raw, 'cat');
    const scale = barChartScale(groups);
    expect(scale.totalRev).toBeGreaterThan(0);
    expect(scale.maxRev).toBeGreaterThan(0);
  });
});

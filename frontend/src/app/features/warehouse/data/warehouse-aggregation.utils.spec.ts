import type { WarehousePosition } from '../../../shared/models';
import {
  buildWarehouseDonutSlices,
  buildWarehouseSubBarGroups,
  computeWarehouseStock,
  topWarehousePositions,
  warehouseSubBarMax,
} from './warehouse-aggregation.utils';

const sample: WarehousePosition[] = [
  {
    productId: 'a',
    name: 'Говядина',
    category: 'Мясо',
    store: 'k',
    qty: 10,
    unit: 'кг',
    value: 1000,
  },
  {
    productId: 'b',
    name: 'Водка',
    category: 'Крепкое',
    store: 'b',
    qty: 5,
    unit: 'л',
    value: 4000,
  },
  {
    productId: 'c',
    name: 'Пино',
    category: 'Красное',
    store: 'w',
    qty: 12,
    unit: 'бут',
    value: 14400,
  },
  {
    productId: 'd',
    name: 'Курица',
    category: 'Мясо',
    store: 'k',
    qty: 20,
    unit: 'кг',
    value: 4000,
  },
  {
    productId: 'e',
    name: 'Минус',
    category: 'Мясо',
    store: 'k',
    qty: -1,
    unit: 'кг',
    value: -100,
  },
];

describe('warehouse-aggregation.utils', () => {
  it('computes stock sum from API value and skips negatives', () => {
    const stock = computeWarehouseStock(sample);
    expect(stock).toHaveLength(4);
    expect(stock[0].sum).toBe(1000);
    expect(stock[1].sum).toBe(4000);
  });

  it('builds donut slices by store', () => {
    const stock = computeWarehouseStock(sample);
    const slices = buildWarehouseDonutSlices(stock);
    expect(slices).toHaveLength(3);
    expect(slices.find((s) => s.key === 'k')?.sum).toBe(5000);
  });

  it('builds subcategory bar groups sorted by sum', () => {
    const stock = computeWarehouseStock(sample);
    const groups = buildWarehouseSubBarGroups(stock);
    const kitchen = groups.find((g) => g.category === 'k');
    expect(kitchen?.rows[0].name).toBe('Мясо');
    expect(warehouseSubBarMax(groups)).toBeGreaterThan(0);
  });

  it('returns top positions by money or qty', () => {
    const stock = computeWarehouseStock(sample);
    const byMoney = topWarehousePositions(stock, 'money', 2);
    expect(byMoney[0].name).toBe('Пино');
    const byQty = topWarehousePositions(stock, 'qty', 2);
    expect(byQty[0].name).toBe('Курица');
  });
});

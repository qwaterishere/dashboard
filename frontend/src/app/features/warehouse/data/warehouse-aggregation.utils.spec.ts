import type { WarehousePosition } from '../../../shared/models';
import {
  buildWarehouseDonutSlices,
  buildWarehouseSubBarGroups,
  computeWarehouseStock,
  topWarehousePositions,
  warehouseSubBarMax,
} from './warehouse-aggregation.utils';

const sample: WarehousePosition[] = [
  { name: 'Говядина', sub: 'Мясо', store: 'k', qty: 10, unit: 'кг', price: 100 },
  { name: 'Водка', sub: 'Крепкое', store: 'b', qty: 5, unit: 'л', price: 800 },
  { name: 'Пино', sub: 'Красное', store: 'w', qty: 12, unit: 'бут', price: 1200 },
  { name: 'Курица', sub: 'Мясо', store: 'k', qty: 20, unit: 'кг', price: 200 },
];

describe('warehouse-aggregation.utils', () => {
  it('computes stock sum as qty × price', () => {
    const stock = computeWarehouseStock(sample);
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
    expect(byQty[0].qty).toBeGreaterThanOrEqual(byQty[1].qty);
  });
});

import type { WarehousePosition } from '../../../shared/models';
import {
  buildWarehouseDonutSlices,
  buildWarehouseSubBarGroups,
  computeWarehouseStock,
  resolveQtyUnitFamily,
  topWarehousePositions,
  topWarehousePositionsByQtyUnit,
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
  {
    productId: 'f',
    name: 'Тарелки',
    category: 'Посуда',
    store: 'k',
    qty: 40,
    unit: 'шт',
    value: 800,
  },
  {
    productId: 'g',
    name: 'Соль',
    category: 'Бакалея',
    store: 'k',
    qty: 3,
    unit: 'кг',
    value: 90,
  },
];

describe('warehouse-aggregation.utils', () => {
  it('computes stock sum from API value and skips negatives', () => {
    const stock = computeWarehouseStock(sample);
    expect(stock).toHaveLength(6);
    expect(stock[0].sum).toBe(1000);
    expect(stock[1].sum).toBe(4000);
  });

  it('builds donut slices by store', () => {
    const stock = computeWarehouseStock(sample);
    const slices = buildWarehouseDonutSlices(stock);
    expect(slices).toHaveLength(3);
    expect(slices.find((s) => s.key === 'k')?.sum).toBe(5890);
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
    expect(byQty[0].name).toBe('Тарелки');
  });

  it('maps units to qty families; прочие → штуки', () => {
    expect(resolveQtyUnitFamily('кг')).toBe('kg');
    expect(resolveQtyUnitFamily('KG')).toBe('kg');
    expect(resolveQtyUnitFamily('л.')).toBe('liter');
    expect(resolveQtyUnitFamily('шт')).toBe('piece');
    expect(resolveQtyUnitFamily('бут')).toBe('piece');
    expect(resolveQtyUnitFamily('уп')).toBe('piece');
  });

  it('groups qty tops by unit family with limit 5 and keeps original unit labels', () => {
    const stock = computeWarehouseStock(sample);
    const groups = topWarehousePositionsByQtyUnit(stock, 5);
    expect(groups.map((g) => g.family)).toEqual(['kg', 'liter', 'piece']);

    const kg = groups.find((g) => g.family === 'kg')!;
    expect(kg.rows[0].name).toBe('Курица');
    expect(kg.rows[0].unit).toBe('кг');
    expect(kg.rows.length).toBeLessThanOrEqual(5);

    const piece = groups.find((g) => g.family === 'piece')!;
    expect(piece.rows.map((r) => r.name)).toContain('Пино');
    expect(piece.rows.find((r) => r.name === 'Пино')?.unit).toBe('бут');
  });
});

import { CAT_COLOR, CAT_NAME, CATEGORY_KEYS } from '../../../shared/constants/category.constants';
import type { CategoryKey, WarehousePosition } from '../../../shared/models';

export type WarehouseStructureLevel = 'cat' | 'sub';
export type TopPositionsMetric = 'money' | 'qty';

export interface WarehouseStockRow {
  productId: string;
  name: string;
  sub: string;
  store: CategoryKey;
  qty: number;
  unit: string;
  sum: number;
}

export interface WarehouseDonutSlice {
  key: CategoryKey;
  name: string;
  color: string;
  sum: number;
}

export interface WarehouseSubBarRow {
  name: string;
  sum: number;
}

export interface WarehouseSubBarGroup {
  category: CategoryKey;
  title: string;
  rows: WarehouseSubBarRow[];
}

/** Положительные остатки: sum = value из API (не qty × price). */
export function computeWarehouseStock(positions: WarehousePosition[]): WarehouseStockRow[] {
  return positions
    .filter((p) => p.qty > 0)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      sub: p.category,
      store: p.store,
      qty: p.qty,
      unit: p.unit,
      sum: p.value,
    }));
}

export function buildWarehouseDonutSlices(stock: WarehouseStockRow[]): WarehouseDonutSlice[] {
  const totals: Partial<Record<CategoryKey, number>> = {};
  stock.forEach((row) => {
    totals[row.store] = (totals[row.store] ?? 0) + row.sum;
  });

  return CATEGORY_KEYS.filter((key) => totals[key])
    .map((key) => ({
      key,
      name: CAT_NAME[key],
      color: CAT_COLOR[key],
      sum: totals[key]!,
    }));
}

export function buildWarehouseSubBarGroups(stock: WarehouseStockRow[]): WarehouseSubBarGroup[] {
  const map = new Map<string, WarehouseSubBarRow & { store: CategoryKey }>();

  stock.forEach((row) => {
    const key = `${row.store}|${row.sub}`;
    const existing = map.get(key);
    if (existing) {
      existing.sum += row.sum;
    } else {
      map.set(key, { store: row.store, name: row.sub, sum: row.sum });
    }
  });

  return CATEGORY_KEYS.map((category) => ({
    category,
    title: CAT_NAME[category],
    rows: [...map.values()]
      .filter((row) => row.store === category)
      .sort((a, b) => b.sum - a.sum)
      .map(({ name, sum }) => ({ name, sum })),
  })).filter((group) => group.rows.length > 0);
}

export function warehouseSubBarMax(groups: WarehouseSubBarGroup[]): number {
  const sums = groups.flatMap((group) => group.rows.map((row) => row.sum));
  return sums.length ? Math.max(...sums) : 0;
}

export function topWarehousePositions(
  stock: WarehouseStockRow[],
  metric: TopPositionsMetric,
  limit = 20,
): WarehouseStockRow[] {
  const sorted = [...stock].sort((a, b) =>
    metric === 'money' ? b.sum - a.sum : b.qty - a.qty,
  );
  return sorted.slice(0, limit);
}

export function topPositionsMax(rows: WarehouseStockRow[], metric: TopPositionsMetric): number {
  if (!rows.length) return 0;
  return Math.max(...rows.map((row) => (metric === 'money' ? row.sum : row.qty)));
}

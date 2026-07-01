import type { CategoryKey } from './common.model';

export interface WarehousePosition {
  name: string;
  sub: string;
  store: CategoryKey;
  qty: number;
  unit: string;
  price: number;
}

export interface DynamicsSeries {
  labels: string[];
  values: number[];
}

export interface WarehouseData {
  asOf: { label: string; note: string };
  totals: {
    value: number;
    stores: number;
    byStore: { key: CategoryKey; name: string; value: number }[];
  };
  positions: WarehousePosition[];
  dynamics: Record<
    CategoryKey | 'all',
    Record<'week' | 'month', DynamicsSeries>
  >;
}

/** Контракт GET /api/warehouse (v2, БД). */

export type WarehouseStoreKey = 'k' | 'b' | 'w';

export interface WarehouseStoreValue {
  key: WarehouseStoreKey;
  value: number;
}

export interface WarehouseStockPosition {
  productId: string;
  name: string;
  category: string;
  store: WarehouseStoreKey;
  qty: number;
  unit: string;
  value: number;
}

export interface WarehouseNegativeStock {
  count: number;
  valueAbs: number;
}

export interface WarehouseDynamicsPoint {
  date: string;
  byStore: WarehouseStoreValue[];
}

export interface WarehouseDataBounds {
  earliest: string | null;
  latest: string | null;
  availableDates: string[];
}

export interface WarehouseApi {
  asOf: string;
  dataBounds: WarehouseDataBounds;
  totals: WarehouseStoreValue[];
  positions: WarehouseStockPosition[];
  negativeStock: WarehouseNegativeStock;
  dynamics: WarehouseDynamicsPoint[];
}

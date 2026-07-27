import type { CategoryKey } from './common.model';
import type {
  WarehouseDynamicsPoint,
  WarehouseNegativeStock,
} from './warehouse-api.model';

/** View-model страницы «Склад» (после маппера из WarehouseApi). */

export interface WarehousePosition {
  productId: string;
  name: string;
  /** Категория номенклатуры (папка) — для баров «по подкатегориям». */
  category: string;
  store: CategoryKey;
  qty: number;
  unit: string;
  /** Стоимость остатка (как в API), не qty × price. */
  value: number;
}

export interface DynamicsSeries {
  labels: string[];
  /** `null` — нет слепка на этот шаг оси (разрыв линии). */
  values: Array<number | null>;
}

export interface WarehouseTotals {
  value: number;
  stores: number;
  byStore: { key: CategoryKey; name: string; value: number }[];
}

export interface WarehouseData {
  asOf: { label: string; note: string; iso: string };
  dataBounds: {
    earliest: string | null;
    latest: string | null;
    availableDates: string[];
  };
  totals: WarehouseTotals;
  positions: WarehousePosition[];
  negativeStock: WarehouseNegativeStock;
  /** Сырые точки графика; агрегация day/week/month и zoom/pan — на UI. */
  dynamicsPoints: WarehouseDynamicsPoint[];
}

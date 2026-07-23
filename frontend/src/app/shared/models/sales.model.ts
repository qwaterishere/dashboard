import type { CategoryKey } from './common.model';

export interface SalesPosition {
  name: string;
  sub: string;
  cat: CategoryKey;
  qty: number;
  price: number;
  unitCost: number;
}

/** Период ответа GET /api/sales (v2 факты + legacy label/note до такта 5). */
export interface SalesPeriod {
  dateFrom: string | null;
  dateTo: string | null;
  label?: string;
  note?: string;
}

export interface SalesData {
  period: SalesPeriod;
  positions: SalesPosition[];
}

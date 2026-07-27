import type { CategoryKey } from './common.model';

export interface SalesPosition {
  name: string;
  sub: string;
  cat: CategoryKey;
  qty: number;
  price: number;
  unitCost: number;
}

/** Период GET /api/sales/snapshot: dateFrom/dateTo; label/note — готовые подписи с бэка. */
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

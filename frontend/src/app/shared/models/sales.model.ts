import type { CategoryKey, PeriodInfo } from './common.model';

export interface SalesPosition {
  name: string;
  sub: string;
  cat: CategoryKey;
  qty: number;
  price: number;
  unitCost: number;
}

export interface SalesData {
  period: PeriodInfo;
  positions: SalesPosition[];
}

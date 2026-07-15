import type { CategoryKey, LflMetric, PeriodInfo } from './common.model';

export interface FoodcostOverviewCard {
  title: string;
  tag: string;
  subtitle: string;
  pct: number;
  lfl: LflMetric;
  goal: number;
  cost: number;
  revenue?: number;
  overSales?: number;
}

export interface FoodcostUnit {
  key: CategoryKey;
  name: string;
  pct: number;
  lfl: LflMetric;
  goal: number;
  cost: number;
  shareOfSpend: number;
}

export interface FoodcostCategoryRow {
  name: string;
  fact: number;
  goal: number;
  cost: number;
}

export interface FoodcostProduct {
  name: string;
  group: CategoryKey;
  price: number;
  cost: number;
}

export interface FoodcostData {
  period: PeriodInfo;
  overview: {
    clean: FoodcostOverviewCard;
    /** null — фаза 2 (writeoffs / dirty foodcost). */
    dirty: FoodcostOverviewCard | null;
  };
  units: FoodcostUnit[];
  losses: {
    rows: { name: string; note: string; fact: number; goal: number }[];
    total: { fact: number; goal: number };
  };
  discounts: {
    label: string;
    value: string;
    caption: string;
    tone?: 'amber';
  }[];
  categories: Record<CategoryKey, FoodcostCategoryRow[]>;
  products: FoodcostProduct[];
}

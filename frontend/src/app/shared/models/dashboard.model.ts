import type { CategoryKey, DetailPopover, LflMetric, PeriodInfo } from './common.model';
import type { PeriodV2 } from './dashboard-v2.model';

export interface KpiBlock {
  value: number;
  lfl?: LflMetric | null;
  forecast: {
    value: number;
    planPct: number;
    trackPct: number;
    risk: boolean;
    headline?: string;
  };
}

export interface RevenueKpi extends KpiBlock {
  checks: number;
  guests: number;
}

export interface AvgCheckKpi extends KpiBlock {
  perGuest: number;
  qualityFlag: boolean;
}

export interface GuestsKpi extends KpiBlock {
  perCheck: number;
  checks: number;
}

export interface RevenueDay {
  day: number;
  weekday: number;
  revenue: number;
  plan: number | null;
  checks: number;
  guests: number;
  avg: number;
}

export interface DashboardData {
  greeting: string;
  period: PeriodInfo;
  chartPeriod: PeriodV2;
  kpis: {
    revenue: RevenueKpi;
    avgCheck: AvgCheckKpi;
    guests: GuestsKpi;
  };
  revenueByDay: RevenueDay[];
  revenueByDayMax: number;
  reviews: {
    score: number;
    count: number;
    split: {
      good: number;
      mid: number;
      bad: number;
      goodPct: number;
      midPct: number;
      badPct: number;
    };
    sources: { name: string; score: number; count: number }[];
  } | null;
  foodcostMini: {
    caption: string;
    items: {
      key: CategoryKey;
      name: string;
      pct: number;
      goal: number;
      deltaPP: number;
      dir: LflMetric['dir'];
    }[];
  };
  categories: { key: CategoryKey; name: string; pct: number }[];
  stock: {
    total: number;
    items: { key: CategoryKey; name: string; value: number }[];
  } | null;
  details: Record<string, DetailPopover>;
}

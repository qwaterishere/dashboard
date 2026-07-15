import type { CategoryKey, DetailPopover, LflMetric, ChartDisplayMode, PeriodInfo } from './common.model';
import type { ApiPeriod, DataBounds } from './api-period.model';

export interface KpiBlock {
  value: number;
  lfl?: LflMetric | null;
  comparisonLabel?: 'LfL' | 'WoW';
  forecast: {
    value: number;
    planPct: number;
    trackPct: number;
    risk: boolean;
    headline?: string;
    /** «Прогноз на конец месяца» / «…года» — зависит от granularity. */
    label?: string;
  };
  weekFooter?: {
    label: string;
    headline: string;
    subline?: string;
    popoverKey?: string;
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
  /** Гостей за период — подпись под основным числом (чеками). */
  guests: number;
  /** Среднее число гостей на чек. */
  perCheck: number;
}

export interface RevenueDay {
  day: number;
  weekday: number;
  revenue: number;
  plan: number | null;
  /** Ожидаемая выручка на конец дня — засечка на графике. */
  forecast: number | null;
  checks: number;
  guests: number;
  avg: number;
  /** Подпись столбца, если отличается от стандартной day/weekday. */
  barLabel?: string;
}

export interface DashboardData {
  greeting: string;
  period: PeriodInfo;
  chartPeriod: ApiPeriod;
  chartDisplayMode: ChartDisplayMode;
  dataBounds: DataBounds;
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

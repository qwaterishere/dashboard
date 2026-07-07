/** Контракт v2 — GET /api/dashboard (docs/frontend-handoff.md §1). */

export interface PeriodV2 {
  year: number;
  month: number;
  dayFrom: number;
  dayTo: number;
}

export interface KpiMetricV2 {
  value: number;
  prev: number | null;
  forecast: number | null;
}

export interface RevenueDayV2 {
  day: number;
  weekday: number;
  revenue: number;
  checks: number;
  guests: number;
  plan: number | null;
}

export interface UnitSumsV2 {
  key: 'k' | 'b' | 'w' | 'o';
  revenue: number;
  cost: number;
  prevRevenue: number;
  prevCost: number;
}

export interface DashboardV2 {
  period: PeriodV2;
  compare: PeriodV2;
  kpis: {
    revenue: KpiMetricV2;
    checks: KpiMetricV2;
    guests: KpiMetricV2;
    avgCheck: KpiMetricV2;
  };
  revenueByDay: RevenueDayV2[];
  units: UnitSumsV2[];
  reviews: null;
  stock: null;
}

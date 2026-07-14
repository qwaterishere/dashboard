/** Контракт GET /api/dashboard (backend/src/schemas/dashboard.py). */

import type { ApiPeriod, DataBounds } from './api-period.model';

export type { ApiPeriod, DataBounds };

export interface KpiMetric {
  value: number;
  prevValue: number | null;
  forecast: number | null;
}

export interface RevenueDayFact {
  day: number;
  weekday: number;
  revenue: number;
  checks: number;
  guests: number;
  plan: number | null;
}

export interface UnitSums {
  key: 'k' | 'b' | 'w' | 'o';
  revenue: number;
  cost: number;
  prevRevenue: number;
  prevCost: number;
}

export interface RevenueMonthFact {
  month: number;
  revenue: number;
  checks: number;
  guests: number;
  plan: number | null;
}

export interface WeekDayStat {
  date: string;
  weekday: number;
  revenue: number;
  checks: number;
  guests: number;
  avgCheck: number;
}

export interface WeekKpiContext {
  weekStart: string;
  weekEnd: string;
  prevWeekStart: string;
  prevWeekEnd: string;
  comparison: 'lfl';
  workingDays: number;
  avgDailyRevenue: number;
  avgDailyChecks: number;
  avgDailyGuests: number;
  avgCheckMin: number;
  avgCheckMax: number;
  peakDay: WeekDayStat | null;
  weakDay: WeekDayStat | null;
  monthRevenueSharePct: number | null;
}

export interface DashboardKpis {
  revenue: KpiMetric;
  checks: KpiMetric;
  guests: KpiMetric;
  avgCheck: KpiMetric;
}

export interface DashboardApi {
  period: ApiPeriod;
  compare: ApiPeriod;
  dataBounds: DataBounds;
  kpis: DashboardKpis;
  revenueByDay: RevenueDayFact[];
  revenueByMonth: RevenueMonthFact[];
  units: UnitSums[];
  weekKpi?: WeekKpiContext | null;
  reviews: null;
  stock: null;
}

/** KPI overlay slice — compare cache + GET /api/dashboard/kpi. */
export type DashboardCompareSlice = Pick<DashboardApi, 'kpis' | 'compare' | 'weekKpi'>;


/** Контракт GET /api/dashboard/chart (backend/src/schemas/dashboard.py). */

import type { ApiPeriod, DataBounds } from './api-period.model';
import type { RevenueDayFact, RevenueMonthFact, UnitSums, WeekKpiContext } from './dashboard-api.model';

export interface DashboardChartApi {
  period: ApiPeriod;
  compare: ApiPeriod;
  dataBounds: DataBounds;
  revenueByDay: RevenueDayFact[];
  revenueByMonth: RevenueMonthFact[];
  units: UnitSums[];
  weekKpi?: WeekKpiContext | null;
}

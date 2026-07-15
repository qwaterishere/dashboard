/** Контракт GET /api/dashboard/kpi — только KPI-слой для LfL overlay. */

import type { ApiPeriod } from './api-period.model';
import type { DashboardApi } from './dashboard-api.model';

export interface DashboardKpiApi {
  period: ApiPeriod;
  compare: ApiPeriod;
  kpis: DashboardApi['kpis'];
  weekKpi?: DashboardApi['weekKpi'];
}

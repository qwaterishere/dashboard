/** KPI overlay view-model (сборка из /api/base-metrics batch/compare/forecast). */

import type { ApiPeriod } from './api-period.model';
import type { DashboardApi } from './dashboard-api.model';

export interface DashboardKpiApi {
  period: ApiPeriod;
  compare: ApiPeriod;
  kpis: DashboardApi['kpis'];
  weekKpi?: DashboardApi['weekKpi'];
}

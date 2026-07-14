import type { DashboardQueryKey } from '../../../core/data/analytics-cache-key';
import { chartSelectionToQuery } from '../../../core/data/analytics-cache-key';
import type { ChartPeriodSelection } from '../../../shared/models/chart-period.model';
import type { PeriodGranularity } from '../../../shared/models/common.model';
import type { ApiPeriod, DataBounds } from '../../../shared/models/api-period.model';
import { resolveEffectiveChartSelection } from '../../dashboard/data/dashboard-chart.utils';

/** Параметры GET /api/foodcost из period bar (неделя → месячный срез). */
export function resolveFoodcostQuery(
  granularity: PeriodGranularity,
  chartPeriod: ChartPeriodSelection | null,
  anchorPeriod: ApiPeriod | null,
  bounds: DataBounds | null = null,
): DashboardQueryKey {
  if (!anchorPeriod) {
    return {};
  }

  const effectiveSelection = resolveEffectiveChartSelection(
    chartPeriod,
    granularity,
    anchorPeriod,
    bounds,
  );
  /** Foodcost API — только month/year; week-mode берёт anchor-month без weekStart/weekEnd. */
  const queryGranularity = granularity === 'week' ? 'month' : granularity;
  return chartSelectionToQuery(effectiveSelection, queryGranularity);
}

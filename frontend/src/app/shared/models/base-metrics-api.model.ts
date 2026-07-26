/** Контракт REST /api/base-metrics/* */

export type BaseMetricName =
  | 'revenue'
  | 'checks'
  | 'guests'
  | 'avg-check'
  | 'avg-check-per-guest';

export type BaseMetricUnit = 'money' | 'count' | 'ratio';
export type SeriesGranularity = 'day' | 'month';
export type SnapshotMode = 'full' | 'chart' | 'kpi';

export interface MetricBoundsApi {
  date_from: string | null;
  date_to: string | null;
}

export interface DefaultPeriodApi {
  date_from: string;
  date_to: string;
  mode: 'month';
  bounds: MetricBoundsApi;
}

export interface MetricBatchItemApi {
  metric: BaseMetricName;
  unit: BaseMetricUnit;
  date_from: string;
  date_to: string;
  value: number | null;
  base_date_from?: string | null;
  base_date_to?: string | null;
  base_value?: number | null;
  base_incomplete?: boolean | null;
}

export interface MetricBatchApi {
  items: MetricBatchItemApi[];
}

export interface SeriesPointApi {
  date: string;
  value: number | null;
}

export interface MetricSeriesApi {
  metric: BaseMetricName;
  unit: BaseMetricUnit;
  date_from: string;
  date_to: string;
  granularity: SeriesGranularity;
  points: SeriesPointApi[];
}

export interface UnitSumsApi {
  key: 'k' | 'b' | 'w' | 'o';
  revenue: number;
  cost: number;
  prev_revenue: number | null;
  prev_cost: number | null;
}

export interface UnitsResponseApi {
  date_from: string;
  date_to: string;
  base_date_from: string | null;
  base_date_to: string | null;
  units: UnitSumsApi[];
}

export interface ForecastPointApi {
  date: string;
  value: number | null;
}

export interface MetricForecastApi {
  metric: 'revenue' | 'checks' | 'guests';
  date_from: string;
  date_to: string;
  horizon_end: string;
  ready: boolean;
  forecast: number | null;
  forecast_today: number | null;
  points: ForecastPointApi[];
}

export interface MetricCompareApi {
  metric: BaseMetricName;
  unit: BaseMetricUnit;
  date_from: string;
  date_to: string;
  value: number | null;
  base_date_from: string;
  base_date_to: string;
  base_value: number | null;
  base_incomplete: boolean;
}

/** Один ответ /api/base-metrics/snapshot — сборка дашборда. */
export interface MetricSnapshotApi {
  mode: SnapshotMode;
  bounds: MetricBoundsApi;
  date_from: string;
  date_to: string;
  compare_date_from: string;
  compare_date_to: string;
  batch: MetricBatchApi;
  units: UnitsResponseApi;
  day_series: MetricSeriesApi[];
  month_series: MetricSeriesApi[];
  forecasts: MetricForecastApi[];
  week_start: string | null;
  week_end: string | null;
  week_batch: MetricBatchApi | null;
  week_units: UnitsResponseApi | null;
  week_day_series: MetricSeriesApi[];
  month_revenue: number | null;
}

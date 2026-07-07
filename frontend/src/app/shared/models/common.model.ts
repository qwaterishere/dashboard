/** Ключ категории: k — кухня, b — бар, w — вино, o — вне подразделений. */
export type CategoryKey = 'k' | 'b' | 'w' | 'o';

export type LflDirection = 'up' | 'dn';

export interface LflMetric {
  pct: number;
  dir: LflDirection;
}

export interface PeriodInfo {
  label: string;
  note: string;
  compareWith?: string;
}

export type PeriodGranularity = 'week' | 'month' | 'year';

export interface ForecastBlock {
  value: number;
  planPct: number;
  trackPct: number;
  risk: boolean;
}

export type PageName = 'dashboard' | 'sales' | 'warehouse' | 'foodcost';

export interface PopoverRow {
  label: string;
  value: string;
  tone?: '' | 'up' | 'dn';
}

export interface DetailPopover {
  title: string;
  rows: [string, string, ('' | 'up' | 'dn')?][];
  footnote: string;
}

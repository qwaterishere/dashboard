/** Период страницы «Продажи» (изолирован от PeriodService дашборда). */

export type SalesPeriodPreset = 'day' | 'week' | 'month' | 'custom';

export interface SalesDateRange {
  dateFrom: string;
  dateTo: string;
}

export interface SalesPeriodSnapshot {
  preset: SalesPeriodPreset;
  range: SalesDateRange;
}

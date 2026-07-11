/** Выбор периода графика / date-pill на dashboard. */
export interface ChartPeriodSelection {
  year: number;
  month: number;
  /** ISO пн выбранной недели (YYYY-MM-DD). */
  weekStartDate?: string;
  /** ISO вс выбранной недели (YYYY-MM-DD). */
  weekEndDate?: string;
}

/** Полная календарная неделя пн–вс. */
export interface ChartWeekRange {
  startDate: string;
  endDate: string;
}

/** Память выбора месяца (1–12); null — последний доступный период. */
export type ChartPeriodMonthMemory = number | null;

/** Память выбора недели: порядковый номер внутри месяца (1-based); null — последний период. */
export type ChartPeriodWeekMemory = number | null;

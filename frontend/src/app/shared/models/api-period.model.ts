/** Период ответа API (year/month/dayFrom/dayTo). */

export interface ApiPeriod {
  year: number;
  month: number;
  dayFrom: number;
  dayTo: number;
}

/** Границы доступных данных в ответе dashboard. */
export interface DataBounds {
  earliest: string | null;
  latest: string | null;
}

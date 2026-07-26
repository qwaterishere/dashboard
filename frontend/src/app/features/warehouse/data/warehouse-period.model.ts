/** Период страницы «Склад» (изолирован от PeriodService дашборда). */

/**
 * `null` — последний доступный слепок (дефолт / «Текущий день»).
 * ISO `yyyy-mm-dd` — конкретный день из `dataBounds.availableDates`.
 */
export type WarehouseDaySelection = string | null;

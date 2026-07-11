import type {
  ChartPeriodSelection,
  ChartWeekRange,
} from '../models/chart-period.model';
import type { PeriodGranularity } from '../models/common.model';
import type { DataBoundsV2, PeriodV2 } from '../models/dashboard-v2.model';
import { CHART_MONTH_LABELS } from '../constants/month-labels.constants';

export { CHART_MONTH_LABELS };

export interface ChartPeriodBounds {
  minYear: number;
  minMonth: number;
  maxYear: number;
  maxMonth: number;
}

export interface WeekRangeOption extends ChartWeekRange {
  label: string;
}

export function resolveChartPeriodBounds(bounds: DataBoundsV2 | null): ChartPeriodBounds | null {
  if (!bounds?.earliest || !bounds.latest) return null;

  const earliest = parseIsoDate(bounds.earliest);
  const latest = parseIsoDate(bounds.latest);
  if (!earliest || !latest) return null;

  return {
    minYear: earliest.year,
    minMonth: earliest.month,
    maxYear: latest.year,
    maxMonth: latest.month,
  };
}

export function isYearInBounds(year: number, limits: ChartPeriodBounds | null): boolean {
  if (!limits) return true;
  return year >= limits.minYear && year <= limits.maxYear;
}

export function isMonthInBounds(
  year: number,
  month: number,
  limits: ChartPeriodBounds | null,
): boolean {
  if (!limits) return month >= 1 && month <= 12;
  if (year < limits.minYear || year > limits.maxYear) return false;
  if (year === limits.minYear && month < limits.minMonth) return false;
  if (year === limits.maxYear && month > limits.maxMonth) return false;
  return month >= 1 && month <= 12;
}

/** Ограничивает номер месяца доступным диапазоном года в dataBounds. */
export function clampChartMonthInYear(
  year: number,
  month: number,
  bounds: DataBoundsV2 | null,
): number {
  const limits = resolveChartPeriodBounds(bounds);
  if (!limits) return Math.min(12, Math.max(1, month));

  if (year < limits.minYear) return limits.minMonth;
  if (year > limits.maxYear) return limits.maxMonth;

  let minMonth = 1;
  let maxMonth = 12;
  if (year === limits.minYear) minMonth = limits.minMonth;
  if (year === limits.maxYear) maxMonth = limits.maxMonth;
  return Math.min(maxMonth, Math.max(minMonth, month));
}

export function toIsoDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function enumerateIsoDateRange(startDate: string, endDate: string): string[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return [];

  const dates: string[] = [];
  let cursor = calendarDate(start.year, start.month, start.day);
  const endTime = calendarDate(end.year, end.month, end.day).getTime();

  while (cursor.getTime() <= endTime) {
    dates.push(dateToIsoString(cursor));
    cursor = addCalendarDays(cursor, 1);
  }

  return dates;
}

export function monthKeysInIsoRange(
  startDate: string,
  endDate: string,
): Array<{ year: number; month: number }> {
  const keys = new Map<string, { year: number; month: number }>();
  for (const iso of enumerateIsoDateRange(startDate, endDate)) {
    const parts = parseIsoDate(iso);
    if (!parts) continue;
    keys.set(`${parts.year}-${parts.month}`, { year: parts.year, month: parts.month });
  }
  return [...keys.values()];
}

/** Порядковый номер недели внутри месяца (1-based). */
export function weekIndexInMonth(
  year: number,
  month: number,
  bounds: DataBoundsV2 | null,
  weekRange: ChartWeekRange,
): number {
  const options = listWeekRangesInMonth(year, month, bounds, weekRange);
  const exactIndex = options.findIndex(
    (option) =>
      option.startDate === weekRange.startDate && option.endDate === weekRange.endDate,
  );
  return exactIndex >= 0 ? exactIndex + 1 : 1;
}

/** Неделя по порядковому номеру внутри месяца; вне диапазона — ближайшая доступная. */
export function resolveWeekByIndexInMonth(
  year: number,
  month: number,
  bounds: DataBoundsV2 | null,
  weekIndex: number,
): ChartWeekRange & { month: number } {
  const resolvedMonth = clampChartMonthInYear(year, month, bounds);
  const options = listWeekRangesInMonth(year, resolvedMonth, bounds);
  if (options.length === 0) {
    const fallback = resolveDefaultWeekForMonth(year, resolvedMonth, bounds, null);
    return { ...fallback, month: resolvedMonth };
  }

  const clampedIndex = Math.min(options.length, Math.max(1, weekIndex));
  const week = options[clampedIndex - 1]!;
  return { startDate: week.startDate, endDate: week.endDate, month: resolvedMonth };
}

export function resolveChartWeekRange(
  selection: ChartPeriodSelection | null,
  period: PeriodV2,
): ChartWeekRange | undefined {
  if (selection?.weekStartDate && selection.weekEndDate) {
    return { startDate: selection.weekStartDate, endDate: selection.weekEndDate };
  }
  return resolveDefaultWeekRange(period.year, period.month, period.dayFrom, period.dayTo);
}

export function chartPeriodSelectionFromWeek(
  anchorYear: number,
  anchorMonth: number,
  week: ChartWeekRange,
): ChartPeriodSelection {
  return {
    year: anchorYear,
    month: anchorMonth,
    weekStartDate: week.startDate,
    weekEndDate: week.endDate,
  };
}

export function listAvailableYears(limits: ChartPeriodBounds | null, fallbackYear: number): number[] {
  if (!limits) return [fallbackYear];
  return Array.from(
    { length: limits.maxYear - limits.minYear + 1 },
    (_, index) => limits.minYear + index,
  );
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function dateToIsoString(date: Date): string {
  return toIsoDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Доступный диапазон дней месяца с учётом dataBounds. */
export function getMonthDayLimits(
  year: number,
  month: number,
  bounds: DataBoundsV2 | null,
): { minDay: number; maxDay: number } {
  let minDay = 1;
  let maxDay = daysInMonth(year, month);

  if (bounds?.earliest) {
    const earliest = parseIsoDate(bounds.earliest);
    if (earliest && earliest.year === year && earliest.month === month) {
      minDay = earliest.day;
    }
  }
  if (bounds?.latest) {
    const latest = parseIsoDate(bounds.latest);
    if (latest && latest.year === year && latest.month === month) {
      maxDay = latest.day;
    }
  }

  return { minDay, maxDay };
}

function formatWeekRangeLabel(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return '';

  if (start.year === end.year && start.month === end.month) {
    return start.day === end.day ? String(start.day) : `${start.day}–${end.day}`;
  }

  const startMonth = CHART_MONTH_LABELS[start.month - 1] ?? '';
  const endMonth = CHART_MONTH_LABELS[end.month - 1] ?? '';
  return `${start.day} ${startMonth} – ${end.day} ${endMonth}`;
}

function calendarDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Понедельник ISO-недели (пн–вс), в которую попадает день. */
function startOfIsoWeek(year: number, month: number, day: number): Date {
  const date = calendarDate(year, month, day);
  const weekday = date.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(date, -daysFromMonday);
}

/** Полная календарная неделя (пн–вс), содержащая anchorDay. */
export function resolveFullIsoWeekRange(
  year: number,
  month: number,
  anchorDay: number,
): ChartWeekRange {
  const weekStart = startOfIsoWeek(year, month, anchorDay);
  const weekEnd = addCalendarDays(weekStart, 6);
  return {
    startDate: dateToIsoString(weekStart),
    endDate: dateToIsoString(weekEnd),
  };
}

/** @deprecated alias — resolveFullIsoWeekRange */
export function resolveCalendarWeekInMonth(
  year: number,
  month: number,
  anchorDay: number,
): ChartWeekRange {
  return resolveFullIsoWeekRange(year, month, anchorDay);
}

/** Дефолтный диапазон графика: полная календарная неделя с dayTo. */
export function resolveDefaultWeekRange(
  year: number,
  month: number,
  _dayFrom: number,
  dayTo: number,
): ChartWeekRange {
  return resolveFullIsoWeekRange(year, month, dayTo);
}

function weekOverlapsDataBounds(
  startDate: string,
  endDate: string,
  bounds: DataBoundsV2 | null,
): boolean {
  if (!bounds?.earliest && !bounds?.latest) return true;

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return true;

  const weekStartMs = calendarDate(start.year, start.month, start.day).getTime();
  const weekEndMs = calendarDate(end.year, end.month, end.day).getTime();

  if (bounds.earliest) {
    const earliest = parseIsoDate(bounds.earliest);
    if (earliest) {
      const boundsStartMs = calendarDate(earliest.year, earliest.month, earliest.day).getTime();
      if (weekEndMs < boundsStartMs) return false;
    }
  }

  if (bounds.latest) {
    const latest = parseIsoDate(bounds.latest);
    if (latest) {
      const boundsEndMs = calendarDate(latest.year, latest.month, latest.day).getTime();
      if (weekStartMs > boundsEndMs) return false;
    }
  }

  return true;
}

export function findWeekOptionForDay(
  options: WeekRangeOption[],
  year: number,
  month: number,
  day: number,
): WeekRangeOption | null {
  const iso = toIsoDateString(year, month, day);
  return options.find((option) => iso >= option.startDate && iso <= option.endDate) ?? null;
}

/** Год совпадает с последним доступным годом в dataBounds / KPI-периоде. */
export function isCurrentChartYear(
  year: number,
  bounds: DataBoundsV2 | null,
  dashboardPeriod: Pick<PeriodV2, 'year'> | null,
): boolean {
  const limits = resolveChartPeriodBounds(bounds);
  if (limits) return year === limits.maxYear;
  if (dashboardPeriod) return year === dashboardPeriod.year;
  return year === new Date().getFullYear();
}

/** Первый месяц года с данными (для прошлых лет). */
export function firstMonthInBounds(year: number, limits: ChartPeriodBounds | null): number {
  if (limits && year === limits.minYear) return limits.minMonth;
  return 1;
}

/** Дефолтный месяц при переключении на month: текущий год → последний месяц, иначе первый. */
export function resolveDefaultChartMonth(
  year: number,
  bounds: DataBoundsV2 | null,
  dashboardPeriod: Pick<PeriodV2, 'year' | 'month'> | null,
): number {
  const limits = resolveChartPeriodBounds(bounds);
  if (isCurrentChartYear(year, bounds, dashboardPeriod)) {
    if (limits && year === limits.maxYear) return limits.maxMonth;
    return dashboardPeriod?.month ?? 1;
  }
  return firstMonthInBounds(year, limits);
}

/** Дефолтная неделя внутри месяца: последняя в KPI-периоде или первая в месяце. */
export function resolveDefaultWeekForMonth(
  year: number,
  month: number,
  bounds: DataBoundsV2 | null,
  dashboardPeriod: PeriodV2 | null,
): ChartWeekRange {
  const limits = resolveChartPeriodBounds(bounds);
  const options = listWeekRangesInMonth(year, month, bounds);
  const isLatestMonthInCurrentYear =
    isCurrentChartYear(year, bounds, dashboardPeriod) &&
    ((limits && year === limits.maxYear && month === limits.maxMonth) ||
      (!limits &&
        dashboardPeriod &&
        year === dashboardPeriod.year &&
        month === dashboardPeriod.month));

  if (isLatestMonthInCurrentYear) {
    if (
      dashboardPeriod &&
      year === dashboardPeriod.year &&
      month === dashboardPeriod.month
    ) {
      return resolveDefaultWeekRange(
        dashboardPeriod.year,
        dashboardPeriod.month,
        dashboardPeriod.dayFrom,
        dashboardPeriod.dayTo,
      );
    }
    const { minDay, maxDay } = getMonthDayLimits(year, month, bounds);
    return resolveDefaultWeekRange(year, month, minDay, maxDay);
  }

  const first = options[0];
  if (first) {
    return { startDate: first.startDate, endDate: first.endDate };
  }

  const { minDay, maxDay } = getMonthDayLimits(year, month, bounds);
  return resolveDefaultWeekRange(year, month, minDay, maxDay);
}

/** Дефолтный chartPeriod при переключении на week. */
export function resolveDefaultChartWeekSelection(
  year: number,
  bounds: DataBoundsV2 | null,
  dashboardPeriod: PeriodV2 | null,
): ChartPeriodSelection {
  const month = resolveDefaultChartMonth(year, bounds, dashboardPeriod);
  const week = resolveDefaultWeekForMonth(year, month, bounds, dashboardPeriod);
  return chartPeriodSelectionFromWeek(year, month, week);
}

/** Календарные недели (пн–вс), пересекающие anchor-month; диапазон — полная неделя. */
export function listWeekRangesInMonth(
  year: number,
  month: number,
  bounds: DataBoundsV2 | null,
  ensureRange?: ChartWeekRange,
): WeekRangeOption[] {
  const lastDay = daysInMonth(year, month);
  const monthStart = calendarDate(year, month, 1);
  const monthEnd = calendarDate(year, month, lastDay);
  const ranges: WeekRangeOption[] = [];

  let weekStart = startOfIsoWeek(year, month, 1);

  while (weekStart.getTime() <= monthEnd.getTime()) {
    const weekEnd = addCalendarDays(weekStart, 6);

    if (weekEnd.getTime() >= monthStart.getTime() && weekStart.getTime() <= monthEnd.getTime()) {
      const startDate = dateToIsoString(weekStart);
      const endDate = dateToIsoString(weekEnd);

      if (weekOverlapsDataBounds(startDate, endDate, bounds)) {
        ranges.push({
          startDate,
          endDate,
          label: formatWeekRangeLabel(startDate, endDate),
        });
      }
    }

    weekStart = addCalendarDays(weekStart, 7);
  }

  if (
    ensureRange &&
    !ranges.some(
      (range) =>
        range.startDate === ensureRange.startDate && range.endDate === ensureRange.endDate,
    )
  ) {
    ranges.push({
      startDate: ensureRange.startDate,
      endDate: ensureRange.endDate,
      label: formatWeekRangeLabel(ensureRange.startDate, ensureRange.endDate),
    });
    ranges.sort((left, right) => left.startDate.localeCompare(right.startDate));
  }

  return ranges;
}

/** Актуальный chartPeriod: последний год / месяц / неделя по dataBounds. */
export function resolveLatestChartPeriodSelection(
  granularity: PeriodGranularity,
  bounds: DataBoundsV2 | null,
  dashboardPeriod: PeriodV2 | null,
): ChartPeriodSelection | null {
  const limits = resolveChartPeriodBounds(bounds);
  const year = limits?.maxYear ?? dashboardPeriod?.year;
  if (year == null) return null;

  if (granularity === 'year') {
    return { year, month: 1 };
  }

  if (granularity === 'month') {
    return {
      year,
      month: resolveDefaultChartMonth(year, bounds, dashboardPeriod),
    };
  }

  return resolveDefaultChartWeekSelection(year, bounds, dashboardPeriod);
}

export function chartPeriodSelectionsEqual(
  left: ChartPeriodSelection,
  right: ChartPeriodSelection,
  granularity: PeriodGranularity,
): boolean {
  if (left.year !== right.year) return false;
  if (granularity === 'year') return true;
  if (left.month !== right.month) return false;
  if (granularity === 'month') return true;
  return left.weekStartDate === right.weekStartDate && left.weekEndDate === right.weekEndDate;
}

/** Показывать «Сбросить», если выбран период и он не совпадает с актуальным. */
export function isChartPeriodResetVisible(
  selection: ChartPeriodSelection | null,
  granularity: PeriodGranularity,
  bounds: DataBoundsV2 | null,
  dashboardPeriod: PeriodV2 | null,
): boolean {
  if (!selection) return false;
  const latest = resolveLatestChartPeriodSelection(granularity, bounds, dashboardPeriod);
  if (!latest) return false;
  return !chartPeriodSelectionsEqual(selection, latest, granularity);
}

/** Тестовый helper: неделя по дню внутри anchor-month. */
export function chartPeriodSelectionForMonthDay(
  year: number,
  month: number,
  day: number,
  bounds: DataBoundsV2 | null = null,
): ChartPeriodSelection {
  const week = resolveFullIsoWeekRange(year, month, day);
  return chartPeriodSelectionFromWeek(year, month, week);
}

import { MONTHS_SHORT } from '../../../shared/constants/month-labels.constants';
import {
  daysInMonth,
  resolveDefaultWeekRange,
  toIsoDateString,
} from '../../../shared/utils/chart-period.utils';
import type { SalesDateRange, SalesPeriodPreset } from './sales-period.model';

function parseIso(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(year, month));
}

/** Нормализует пару дат (swap если from > to). */
export function normalizeSalesDateRange(dateFrom: string, dateTo: string): SalesDateRange {
  return dateFrom <= dateTo
    ? { dateFrom, dateTo }
    : { dateFrom: dateTo, dateTo: dateFrom };
}

/** Диапазон пресета от якоря (обычно last closed / dateTo). */
export function computeSalesPresetRange(
  preset: Exclude<SalesPeriodPreset, 'custom'>,
  anchorIso: string,
): SalesDateRange {
  const anchor = parseIso(anchorIso);
  if (!anchor) {
    return { dateFrom: anchorIso, dateTo: anchorIso };
  }

  if (preset === 'day') {
    const iso = toIsoDateString(
      anchor.year,
      anchor.month,
      clampDay(anchor.year, anchor.month, anchor.day),
    );
    return { dateFrom: iso, dateTo: iso };
  }

  if (preset === 'week') {
    const week = resolveDefaultWeekRange(anchor.year, anchor.month, anchor.day, anchor.day);
    return { dateFrom: week.startDate, dateTo: week.endDate };
  }

  // month: 1-е … min(конец месяца, anchor) — якорь = last closed
  const from = toIsoDateString(anchor.year, anchor.month, 1);
  const to = toIsoDateString(
    anchor.year,
    anchor.month,
    clampDay(anchor.year, anchor.month, anchor.day),
  );
  return { dateFrom: from, dateTo: to };
}

/** Подпись диапазона для period pill (ru-RU). */
export function formatSalesPeriodLabel(dateFrom: string, dateTo: string): string {
  const from = parseIso(dateFrom);
  const to = parseIso(dateTo);
  if (!from || !to) return `${dateFrom} — ${dateTo}`;

  const fromMonth = MONTHS_SHORT[from.month - 1] ?? '';
  const toMonth = MONTHS_SHORT[to.month - 1] ?? '';

  if (dateFrom === dateTo) {
    return `${from.day} ${fromMonth} ${from.year}`;
  }

  if (from.year === to.year && from.month === to.month) {
    return `${from.day}–${to.day} ${toMonth} ${to.year}`;
  }

  if (from.year === to.year) {
    return `${from.day} ${fromMonth} — ${to.day} ${toMonth} ${to.year}`;
  }

  return `${from.day} ${fromMonth} ${from.year} — ${to.day} ${toMonth} ${to.year}`;
}

export function salesPresetNote(preset: SalesPeriodPreset): string {
  switch (preset) {
    case 'day':
      return 'один день';
    case 'week':
      return 'календарная неделя · пн–вс';
    case 'month':
      return 'с 1-го числа';
    case 'custom':
      return 'произвольный период';
  }
}

export function todayIsoDate(): string {
  const now = new Date();
  return toIsoDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

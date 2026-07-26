import { MONTHS_SHORT } from '../../../shared/constants/month-labels.constants';
import { daysInMonth, toIsoDateString } from '../../../shared/utils/chart-period.utils';
import { parseIsoDate } from '../../../shared/utils/iso-date.utils';

export const WAREHOUSE_WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

const DATE_LONG = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export interface WarehouseCalendarCell {
  key: string;
  iso: string | null;
  label: string;
  disabled: boolean;
  active: boolean;
  /** Есть слепок (из availableDates). */
  available: boolean;
}

export function formatWarehouseDayLabel(iso: string): string {
  return DATE_LONG.format(parseIsoDate(iso));
}

export function formatWarehouseMonthTitle(year: number, month: number): string {
  const name = MONTHS_SHORT[month - 1] ?? '';
  return `${name} ${year}`;
}

export function parseWarehouseIso(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function shiftWarehouseMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Сетка месяца: кликабельны только дни из `availableDates`. */
export function buildWarehouseCalendarCells(
  year: number,
  month: number,
  selectedIso: string | null,
  availableDates: ReadonlySet<string>,
): WarehouseCalendarCell[] {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const totalDays = daysInMonth(year, month);
  const cells: WarehouseCalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({
      key: `pad-${i}`,
      iso: null,
      label: '',
      disabled: true,
      active: false,
      available: false,
    });
  }

  for (let day = 1; day <= totalDays; day++) {
    const iso = toIsoDateString(year, month, day);
    const available = availableDates.has(iso);
    cells.push({
      key: iso,
      iso,
      label: String(day),
      disabled: !available,
      active: !!selectedIso && iso === selectedIso,
      available,
    });
  }

  while (cells.length % 7 !== 0) {
    const i = cells.length;
    cells.push({
      key: `pad-end-${i}`,
      iso: null,
      label: '',
      disabled: true,
      active: false,
      available: false,
    });
  }

  return cells;
}

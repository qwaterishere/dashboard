/** Календарные даты ISO (YYYY-MM-DD) без TZ-сдвигов. */

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function addDays(iso: string, delta: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + delta);
  return formatIsoDate(date);
}

/** 0=вс..6=сб — как в контракте RevenueDay / palette.WEEKDAYS_SHORT. */
export function weekdayJs(iso: string): number {
  return parseIsoDate(iso).getDay();
}

export function shiftMonth(year: number, month: number, delta = -1): { year: number; month: number } {
  let nextMonth = month + delta;
  let nextYear = year;
  while (nextMonth < 1) {
    nextMonth += 12;
    nextYear -= 1;
  }
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
}

/** Предыдущий период той же длины: полный месяц → полный предыдущий; иначе те же дни прошлого месяца. */
export function previousPeriodRange(
  dateFrom: string,
  dateTo: string,
): { dateFrom: string; dateTo: string } {
  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);
  if (from > to) {
    throw new Error('invalid period');
  }

  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    const days = daysInMonth(from.getFullYear(), from.getMonth() + 1);
    const prev = shiftMonth(from.getFullYear(), from.getMonth() + 1);
    const prevLast = daysInMonth(prev.year, prev.month);

    if (from.getDate() === 1 && to.getDate() === days) {
      return {
        dateFrom: formatIsoDate(new Date(prev.year, prev.month - 1, 1)),
        dateTo: formatIsoDate(new Date(prev.year, prev.month - 1, prevLast)),
      };
    }

    if (from.getDate() === 1) {
      return {
        dateFrom: formatIsoDate(new Date(prev.year, prev.month - 1, 1)),
        dateTo: formatIsoDate(
          new Date(prev.year, prev.month - 1, Math.min(to.getDate(), prevLast)),
        ),
      };
    }
  }

  const length = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevEnd = addDays(dateFrom, -1);
  const prevStart = addDays(prevEnd, -(length - 1));
  return { dateFrom: prevStart, dateTo: prevEnd };
}

export function previousWeekRange(
  weekStart: string,
  weekEnd: string,
): { dateFrom: string; dateTo: string } {
  return previousPeriodRange(weekStart, weekEnd);
}

export function isoToApiPeriod(dateFrom: string, dateTo: string): {
  year: number;
  month: number;
  dayFrom: number;
  dayTo: number;
} {
  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);
  return {
    year: from.getFullYear(),
    month: from.getMonth() + 1,
    dayFrom: from.getDate(),
    dayTo: to.getDate(),
  };
}

/** Для year-mode period dict: dayFrom/dayTo = номера месяцев 1..12. */
export function yearApiPeriod(year: number, monthFrom: number, monthTo: number): {
  year: number;
  month: number;
  dayFrom: number;
  dayTo: number;
} {
  return { year, month: monthFrom, dayFrom: monthFrom, dayTo: monthTo };
}

import { WEEKDAYS_SHORT } from '../../../shared/constants/category.constants';
import type { DetailPopover } from '../../../shared/models/common.model';
import type { DashboardData } from '../../../shared/models/dashboard.model';
import type { DashboardApi, WeekKpiContext } from '../../../shared/models/dashboard-api.model';

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString('ru-RU');
}

function formatDayShort(weekday: number): string {
  return WEEKDAYS_SHORT[weekday] ?? '';
}

export interface WeekKpiFooters {
  revWeekAvgDetail: DetailPopover;
  revenueWeekFooter: NonNullable<DashboardData['kpis']['revenue']['weekFooter']>;
  avgCheckWeekFooter: NonNullable<DashboardData['kpis']['avgCheck']['weekFooter']>;
  checksWeekFooter: NonNullable<DashboardData['kpis']['guests']['weekFooter']>;
}

/** Footers и popover «средний день» для недельного датафрейма (LfL — в основном mapper). */
export function buildWeekKpiFooters(
  data: DashboardApi,
  week: WeekKpiContext,
): WeekKpiFooters {
  const { kpis } = data;

  const avgDailyAvgCheck =
    week.avgDailyChecks > 0
      ? Math.round(week.avgDailyRevenue / week.avgDailyChecks)
      : kpis.avgCheck.value;

  return {
    revWeekAvgDetail: {
      title: 'Средний день — выручка',
      rows: [
        ['За неделю', formatMoney(kpis.revenue.value)],
        ['Средний день', formatMoney(week.avgDailyRevenue)],
        ['Рабочих дней', String(week.workingDays)],
      ],
      footnote: week.peakDay
        ? `Пик: ${formatDayShort(week.peakDay.weekday)} · ${formatMoney(week.peakDay.revenue)}`
        : 'Средняя выручка за календарный день недели.',
    },
    revenueWeekFooter: {
      label: 'Средний день',
      headline: formatMoney(week.avgDailyRevenue),
      popoverKey: 'rev-week-avg',
    },
    avgCheckWeekFooter: {
      label: 'Средний день',
      headline: formatMoney(avgDailyAvgCheck),
    },
    checksWeekFooter: {
      label: 'Средний день',
      headline: formatCount(week.avgDailyChecks),
    },
  };
}

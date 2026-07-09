import { CAT_NAME } from '../../../shared/constants/category.constants';
import type { CategoryKey, DetailPopover, LflDirection, LflMetric, PeriodGranularity } from '../../../shared/models/common.model';
import type { DashboardData, RevenueDay } from '../../../shared/models/dashboard.model';
import type {
  DashboardV2,
  KpiMetricV2,
  RevenueDayV2,
  UnitSumsV2,
} from '../../../shared/models/dashboard-v2.model';
import type { WarehouseData } from '../../../shared/models/warehouse.model';
import {
  buildPeriodInfo,
  filterRevenueDays,
  formatChartPeriodLabel,
  formatCompareWith,
  formatPeriodRange,
} from '../../../shared/utils/period-format.utils';

export interface DashboardViewModelOptions {
  granularity?: PeriodGranularity;
  stock?: DashboardData['stock'];
  chartPeriodLabel?: string;
}

const KBW: CategoryKey[] = ['k', 'b', 'w'];

function lfl(value: number, prev: number | null): LflMetric | null {
  if (prev === null || prev === 0) return null;
  const pct = ((value - prev) / prev) * 100;
  return { pct, dir: (pct >= 0 ? 'up' : 'dn') as LflDirection };
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatSignedMoney(delta: number): string {
  const sign = delta >= 0 ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(delta))}`;
}

function forecastBlock(metric: KpiMetricV2, formatValue: (n: number) => string) {
  const forecast = metric.forecast;
  if (forecast === null) {
    return { value: 0, planPct: 0, trackPct: 0, risk: false, headline: '—' };
  }
  const trackPct = metric.value > 0 ? Math.min(100, Math.round((metric.value / forecast) * 1000) / 10) : 0;
  return {
    value: forecast,
    planPct: 100,
    trackPct,
    risk: trackPct < 90,
    headline: formatValue(forecast),
  };
}

function buildLflPopover(
  title: string,
  label: string,
  current: number,
  prev: number | null,
  format: (n: number) => string,
  footnote: string,
): DetailPopover {
  const metric = lfl(current, prev);
  const rows: DetailPopover['rows'] = [
    [label, format(prev ?? 0)],
    ['Текущий период', format(current)],
  ];
  if (metric && prev !== null) {
    rows.push(['Разница', formatSignedMoney(current - prev), metric.dir]);
  }
  return { title, rows, footnote };
}

function buildGoalPopover(title: string, metric: KpiMetricV2, format: (n: number) => string): DetailPopover {
  const fc = forecastBlock(metric, format);
  return {
    title,
    rows: [
      ['Сейчас', format(metric.value)],
      ['Прогноз на конец месяца', fc.headline],
    ],
    footnote: 'Run-rate по средним рабочим дням недели. Планы появятся с модулем targets.',
  };
}

function buildFoodcostMini(units: UnitSumsV2[]): DashboardData['foodcostMini'] {
  const byKey = Object.fromEntries(units.map((u) => [u.key, u])) as Record<string, UnitSumsV2>;
  return {
    caption: 'Средняя себестоимость продаж за период',
    items: KBW.map((key) => {
      const unit = byKey[key];
      const pct = unit.revenue ? (unit.cost / unit.revenue) * 100 : 0;
      const prevPct = unit.prevRevenue ? (unit.prevCost / unit.prevRevenue) * 100 : 0;
      const deltaPP = pct - prevPct;
      return {
        key,
        name: CAT_NAME[key],
        pct,
        goal: prevPct,
        deltaPP,
        dir: deltaPP >= 0 ? 'dn' : 'up',
      };
    }),
  };
}

function buildCategories(units: UnitSumsV2[]): DashboardData['categories'] {
  const kbw = units.filter((u) => KBW.includes(u.key as CategoryKey) && u.revenue > 0);
  const total = kbw.reduce((sum, u) => sum + u.revenue, 0);
  return kbw.map((u) => ({
    key: u.key as CategoryKey,
    name: CAT_NAME[u.key as CategoryKey],
    pct: total ? Math.round((u.revenue / total) * 100) : 0,
  }));
}

function toRevenueDays(days: RevenueDayV2[]): RevenueDay[] {
  return days.map((d) => ({
    day: d.day,
    weekday: d.weekday,
    revenue: d.revenue,
    plan: d.plan,
    checks: d.checks,
    guests: d.guests,
    avg: d.checks ? d.revenue / d.checks : 0,
  }));
}

/** Собирает stock panel из stub GET /api/warehouse. */
export function buildStockFromWarehouse(data: WarehouseData): NonNullable<DashboardData['stock']> {
  return {
    total: data.totals.value,
    items: data.totals.byStore.map((store) => ({
      key: store.key,
      name: store.name,
      value: store.value,
    })),
  };
}

/** Преобразует контракт v2 API в view-model для существующих organism-компонентов. */
export function buildDashboardViewModel(
  data: DashboardV2,
  options: DashboardViewModelOptions = {},
): DashboardData {
  const { kpis, period, compare } = data;
  const granularity = options.granularity ?? 'month';
  const revLfl = lfl(kpis.revenue.value, kpis.revenue.prevValue);
  const checkLfl = lfl(kpis.avgCheck.value, kpis.avgCheck.prevValue);
  const guestsLfl = lfl(kpis.guests.value, kpis.guests.prevValue);

  const periodInfo = buildPeriodInfo(period, compare);
  const compareLabel = formatCompareWith(compare);

  const details: Record<string, DetailPopover> = {
    'rev-lfl': buildLflPopover(
      'LfL — выручка',
      compareLabel,
      kpis.revenue.value,
      kpis.revenue.prevValue,
      formatMoney,
      `Сравнение календарное: ${formatPeriodRange(compare)}.`,
    ),
    'check-lfl': buildLflPopover(
      'LfL — средний чек',
      compareLabel,
      kpis.avgCheck.value,
      kpis.avgCheck.prevValue,
      formatMoney,
      'Средний чек = выручка / число чеков с выручкой.',
    ),
    'guests-lfl': buildLflPopover(
      'LfL — гости',
      compareLabel,
      kpis.guests.value,
      kpis.guests.prevValue,
      (n) => Math.round(n).toLocaleString('ru-RU'),
      `Сравнение календарное: ${formatPeriodRange(compare)}.`,
    ),
    'rev-goal': buildGoalPopover('Прогноз — выручка', kpis.revenue, formatMoney),
    'check-goal': buildGoalPopover('Прогноз — средний чек', kpis.avgCheck, formatMoney),
    'guests-goal': buildGoalPopover('Прогноз — гости', kpis.guests, (n) => Math.round(n).toLocaleString('ru-RU')),
  };

  const filteredDays = filterRevenueDays(data.revenueByDay, period, granularity);
  const revenueDays = toRevenueDays(filteredDays);
  const maxRevenue = revenueDays.reduce(
    (max, d) => Math.max(max, d.revenue, d.plan ?? 0),
    1,
  );
  const chartLabel =
    options.chartPeriodLabel ?? formatChartPeriodLabel(period, granularity);

  return {
    greeting: '',
    chartPeriod: period,
    period: {
      ...periodInfo,
      label: chartLabel,
    },
    kpis: {
      revenue: {
        value: kpis.revenue.value,
        lfl: revLfl ?? undefined,
        checks: kpis.checks.value,
        guests: kpis.guests.value,
        forecast: {
          ...forecastBlock(kpis.revenue, (n) => `${(n / 1e6).toFixed(1).replace('.', ',')} млн`),
        },
      },
      avgCheck: {
        value: kpis.avgCheck.value,
        lfl: checkLfl ?? undefined,
        perGuest: kpis.guests.value ? kpis.revenue.value / kpis.guests.value : 0,
        qualityFlag: false,
        forecast: forecastBlock(kpis.avgCheck, formatMoney),
      },
      guests: {
        value: kpis.guests.value,
        lfl: guestsLfl ?? undefined,
        perCheck: kpis.checks.value ? kpis.guests.value / kpis.checks.value : 0,
        checks: kpis.checks.value,
        forecast: forecastBlock(kpis.guests, (n) => Math.round(n).toLocaleString('ru-RU')),
      },
    },
    revenueByDay: revenueDays,
    revenueByDayMax: maxRevenue * 1.1,
    reviews: data.reviews,
    foodcostMini: buildFoodcostMini(data.units),
    categories: buildCategories(data.units),
    stock: options.stock ?? data.stock,
    details,
  };
}

import { CAT_NAME } from '../../../shared/constants/category.constants';
import type { ChartWeekRange } from '../../../shared/models/chart-period.model';
import type { CategoryKey, ChartDisplayMode, DetailPopover, LflDirection, LflMetric, PeriodGranularity } from '../../../shared/models/common.model';
import type { DashboardData } from '../../../shared/models/dashboard.model';
import type {
  DashboardApi,
  KpiMetric,
  UnitSums,
  WeekKpiContext,
} from '../../../shared/models/dashboard-api.model';
import { buildWeekKpiFooters } from './dashboard-week.mapper';
import type { WarehouseData } from '../../../shared/models/warehouse.model';
import type { FoodcostApi } from '../../../shared/models/foodcost-api.model';
import {
  buildDashboardFoodcostMini,
  buildDashboardRevenueCategories,
} from '../../foodcost/data/foodcost.mapper';
import { defaultChartDisplayMode } from '../../../shared/constants/chart-display.constants';
import { buildChartDisplaySeries } from '../../../shared/utils/chart-display.utils';
import {
  buildPeriodInfo,
  filterRevenueDays,
  formatChartPeriodLabel,
  formatCompareWith,
  formatPeriodRange,
  monthRangeFromSeries,
} from '../../../shared/utils/period-format.utils';

export interface DashboardViewModelOptions {
  granularity?: PeriodGranularity;
  chartDisplayMode?: ChartDisplayMode;
  stock?: DashboardData['stock'];
  chartPeriodLabel?: string;
  weekRange?: ChartWeekRange;
  weekDayLookup?: (year: number, month: number, day: number) => import('../../../shared/models/dashboard-api.model').RevenueDayFact | undefined;
  /** Факты фудкоста за тот же период — для mini-панели и donut категорий. */
  foodcost?: FoodcostApi | null;
  weekKpi?: WeekKpiContext | null;
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

function forecastBlock(metric: KpiMetric, formatValue: (n: number) => string) {
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

function buildGoalPopover(title: string, metric: KpiMetric, format: (n: number) => string): DetailPopover {
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

function buildFoodcostMini(units: UnitSums[]): DashboardData['foodcostMini'] {
  const byKey = Object.fromEntries(units.map((u) => [u.key, u])) as Record<string, UnitSums>;
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

function buildCategories(units: UnitSums[]): DashboardData['categories'] {
  const kbw = units.filter((u) => KBW.includes(u.key as CategoryKey) && u.revenue > 0);
  const total = kbw.reduce((sum, u) => sum + u.revenue, 0);
  return kbw.map((u) => ({
    key: u.key as CategoryKey,
    name: CAT_NAME[u.key as CategoryKey],
    pct: total ? Math.round((u.revenue / total) * 100) : 0,
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

/** Преобразует контракт API в view-model для существующих organism-компонентов. */
export function buildDashboardViewModel(
  data: DashboardApi,
  options: DashboardViewModelOptions = {},
): DashboardData {
  const chartCore = buildDashboardChartCore(data, options);
  const kpiLayer = buildDashboardKpiLayer(data, options);
  return {
    ...chartCore,
    period: {
      ...chartCore.period,
      compareWith: kpiLayer.period.compareWith,
    },
    kpis: kpiLayer.kpis,
    details: kpiLayer.details,
  };
}

/** Chart/structure слой — не зависит от LfL overlay. */
export function buildDashboardChartCore(
  data: DashboardApi,
  options: DashboardViewModelOptions = {},
): Omit<DashboardData, 'kpis' | 'details'> & { details: Record<string, DetailPopover> } {
  const { period } = data;
  const granularity = options.granularity ?? 'month';
  const filteredDays = filterRevenueDays(
    data.revenueByDay,
    period,
    granularity,
    options.weekRange,
    options.weekDayLookup,
  );
  const chartDisplayMode = options.chartDisplayMode ?? defaultChartDisplayMode(granularity);
  const revenueDays = buildChartDisplaySeries(
    {
      daily: filteredDays,
      monthly: data.revenueByMonth ?? [],
      period,
      timeframe: granularity,
      weekRange: options.weekRange,
      weekDayLookup: options.weekDayLookup,
    },
    chartDisplayMode,
  );
  const maxRevenue = revenueDays.reduce(
    (max, d) => Math.max(max, d.revenue, d.plan ?? 0),
    1,
  );
  const monthRange = monthRangeFromSeries(data.revenueByMonth ?? []);
  const chartLabel =
    options.chartPeriodLabel ??
    formatChartPeriodLabel(period, granularity, monthRange ?? undefined, options.weekRange);

  const periodInfo = buildPeriodInfo(period, data.compare);

  return {
    greeting: '',
    chartPeriod: period,
    chartDisplayMode,
    dataBounds: data.dataBounds,
    period: {
      ...periodInfo,
      label: chartLabel,
    },
    revenueByDay: revenueDays,
    revenueByDayMax: maxRevenue * 1.1,
    reviews: data.reviews,
    foodcostMini: options.foodcost
      ? buildDashboardFoodcostMini(options.foodcost.units)
      : buildFoodcostMini(data.units),
    categories: options.foodcost
      ? buildDashboardRevenueCategories(options.foodcost.units)
      : buildCategories(data.units),
    stock: options.stock ?? data.stock,
    details: {},
  };
}

/** KPI-слой — зависит от compare overlay. */
export function buildDashboardKpiLayer(
  data: Pick<DashboardApi, 'kpis' | 'compare' | 'weekKpi' | 'period'>,
  options: DashboardViewModelOptions = {},
): Pick<DashboardData, 'kpis' | 'details' | 'period'> {
  const { kpis, compare, period } = data;
  const granularity = options.granularity ?? 'month';
  const weekKpi = options.weekKpi ?? data.weekKpi ?? null;
  const isWeekMode = granularity === 'week' && weekKpi != null;
  const weekFooters = isWeekMode ? buildWeekKpiFooters(data as DashboardApi, weekKpi) : null;
  const showLfl = granularity !== 'year';

  const revLfl = lfl(kpis.revenue.value, kpis.revenue.prevValue);
  const checkLfl = lfl(kpis.avgCheck.value, kpis.avgCheck.prevValue);
  const checksLfl = lfl(kpis.checks.value, kpis.checks.prevValue);

  const periodInfo = buildPeriodInfo(period, compare);
  const compareLabel = formatCompareWith(compare);

  const details: Record<string, DetailPopover> = {
    'rev-lfl': buildLflPopover(
      'LfL — выручка',
      compareLabel,
      kpis.revenue.value,
      kpis.revenue.prevValue,
      formatMoney,
      `Сравнение с предыдущим периодом: ${formatPeriodRange(compare)}.`,
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
      'LfL — чеки',
      compareLabel,
      kpis.checks.value,
      kpis.checks.prevValue,
      (n) => Math.round(n).toLocaleString('ru-RU'),
      `Сравнение с предыдущим периодом: ${formatPeriodRange(compare)}.`,
    ),
    'rev-goal': buildGoalPopover('Прогноз — выручка', kpis.revenue, formatMoney),
    'check-goal': buildGoalPopover('Прогноз — средний чек', kpis.avgCheck, formatMoney),
    'guests-goal': buildGoalPopover(
      'Прогноз — чеки',
      kpis.checks,
      (n) => Math.round(n).toLocaleString('ru-RU'),
    ),
  };

  if (weekFooters) {
    details['rev-week-avg'] = weekFooters.revWeekAvgDetail;
  }

  return {
    period: {
      ...periodInfo,
      compareWith: formatCompareWith(compare),
    },
    kpis: {
      revenue: {
        value: kpis.revenue.value,
        lfl: showLfl ? (revLfl ?? undefined) : undefined,
        comparisonLabel: showLfl ? 'LfL' : undefined,
        checks: kpis.checks.value,
        guests: kpis.guests.value,
        weekFooter: weekFooters?.revenueWeekFooter,
        forecast: {
          ...forecastBlock(kpis.revenue, (n) => `${(n / 1e6).toFixed(1).replace('.', ',')} млн`),
        },
      },
      avgCheck: {
        value: kpis.avgCheck.value,
        lfl: showLfl ? (checkLfl ?? undefined) : undefined,
        comparisonLabel: showLfl ? 'LfL' : undefined,
        perGuest: kpis.guests.value ? kpis.revenue.value / kpis.guests.value : 0,
        qualityFlag: false,
        weekFooter: weekFooters?.avgCheckWeekFooter,
        forecast: forecastBlock(kpis.avgCheck, formatMoney),
      },
      guests: {
        value: kpis.checks.value,
        lfl: showLfl ? (checksLfl ?? undefined) : undefined,
        comparisonLabel: showLfl ? 'LfL' : undefined,
        guests: kpis.guests.value,
        perCheck: kpis.checks.value ? kpis.guests.value / kpis.checks.value : 0,
        weekFooter: weekFooters?.checksWeekFooter,
        forecast: forecastBlock(kpis.checks, (n) => Math.round(n).toLocaleString('ru-RU')),
      },
    },
    details,
  };
}

/** Накладывает KPI overlay на chart view-model без пересборки графика. */
export function patchDashboardKpiLayer(
  chartVm: DashboardData,
  data: Pick<DashboardApi, 'kpis' | 'compare' | 'weekKpi' | 'period'>,
  options: DashboardViewModelOptions = {},
): DashboardData {
  const kpiLayer = buildDashboardKpiLayer(data, options);
  return {
    ...chartVm,
    period: {
      ...chartVm.period,
      compareWith: kpiLayer.period.compareWith,
    },
    kpis: kpiLayer.kpis,
    details: {
      ...chartVm.details,
      ...kpiLayer.details,
    },
  };
}

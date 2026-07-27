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
} from '../../foodcost/data/foodcost.mapper';
import { defaultChartDisplayMode } from '../../../shared/constants/chart-display.constants';
import { buildChartDisplaySeries, chartSeriesMaxValue } from '../../../shared/utils/chart-display.utils';
import {
  buildPeriodInfo,
  filterRevenueDays,
  formatChartPeriodLabel,
  formatCompareWith,
  formatPeriodRange,
  monthRangeFromSeries,
} from '../../../shared/utils/period-format.utils';
import { formatMoney } from '../../../shared/utils/money-format.utils';
import { foodcostGaugeScale } from '../../../shared/utils/foodcost-gauge.utils';

export interface DashboardViewModelOptions {
  granularity?: PeriodGranularity;
  chartDisplayMode?: ChartDisplayMode;
  stock?: DashboardData['stock'];
  chartPeriodLabel?: string;
  weekRange?: ChartWeekRange;
  weekDayLookup?: (year: number, month: number, day: number) => import('../../../shared/models/dashboard-api.model').RevenueDayFact | undefined;
  /** Месячный foodcost для mini-карточки FC (категории берутся из dashboard.units). */
  foodcost?: FoodcostApi | null;
  weekKpi?: WeekKpiContext | null;
}

const KBW: CategoryKey[] = ['k', 'b', 'w'];

/** «за июнь» — винительный = именительный для названий месяцев. */
const MONTHS_FOR_ZA = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const;

function foodcostMiniCaption(year: number, month: number | null | undefined): string {
  if (month == null || month < 1 || month > 12) {
    return `Средняя себестоимость продаж за ${year} год`;
  }
  return `Средняя себестоимость продаж за ${MONTHS_FOR_ZA[month - 1]}`;
}

function categoriesCaption(granularity: PeriodGranularity): string {
  switch (granularity) {
    case 'week':
      return 'Доля в выручке за неделю';
    case 'year':
      return 'Доля в выручке за год';
    default:
      return 'Доля в выручке за месяц';
  }
}

function lfl(value: number, prev: number | null): LflMetric | null {
  if (prev === null || prev === 0) return null;
  const pct = ((value - prev) / prev) * 100;
  return { pct, dir: (pct >= 0 ? 'up' : 'dn') as LflDirection };
}

function formatSignedValue(delta: number, format: (n: number) => string): string {
  const sign = delta >= 0 ? '+' : '−';
  return `${sign}${format(Math.abs(delta))}`;
}

export function forecastLabelForGranularity(
  granularity: PeriodGranularity,
  fromPlan = false,
): string {
  if (fromPlan) {
    if (granularity === 'year') return 'План на конец года';
    if (granularity === 'week') return 'План на конец недели';
    return 'План на конец месяца';
  }
  if (granularity === 'year') return 'Прогноз на конец года';
  if (granularity === 'week') return 'Прогноз на конец недели';
  return 'Прогноз на конец месяца';
}

/** Отставание факта от pace (forecastToday) больше 2% → risk на progress bar. */
const PACE_RISK_RATIO = 0.98;

function forecastBlock(
  metric: KpiMetric,
  formatValue: (n: number) => string,
  granularity: PeriodGranularity = 'month',
  fromPlan = false,
) {
  const label = forecastLabelForGranularity(granularity, fromPlan);
  const forecast = metric.forecast;
  const pace = metric.forecastToday;
  if (forecast === null) {
    return {
      value: 0,
      planPct: 0,
      trackPct: 0,
      risk: false,
      headline: '—',
      label,
    };
  }
  const trackPct =
    metric.value > 0 ? Math.min(100, Math.round((metric.value / forecast) * 1000) / 10) : 0;
  const planPct =
    pace != null && pace > 0
      ? Math.min(100, Math.round((pace / forecast) * 1000) / 10)
      : 0;
  const risk = pace != null && pace > 0 && metric.value < pace * PACE_RISK_RATIO;
  return {
    value: forecast,
    planPct,
    trackPct,
    risk,
    headline: formatValue(forecast),
    label,
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
    rows.push(['Разница', formatSignedValue(current - prev, format), metric.dir]);
  }
  return { title, rows, footnote };
}

function buildGoalPopover(
  title: string,
  metric: KpiMetric,
  format: (n: number) => string,
  granularity: PeriodGranularity = 'month',
  fromPlan = false,
): DetailPopover {
  const fc = forecastBlock(metric, format, granularity, fromPlan);
  const rows: DetailPopover['rows'] = [
    ['Сейчас', format(metric.value)],
  ];
  if (metric.forecastToday != null) {
    rows.push(['Ожидание на сегодня', format(metric.forecastToday)]);
  }
  rows.push([fc.label, fc.headline]);
  return {
    title,
    rows,
    footnote: fromPlan
      ? 'Ожидание и план месяца — из раздела «Цели» (профиль недели и ручные дни). Красный трек — факт ниже ожидания к текущему дню более чем на 2%.'
      : 'Run-rate по средним рабочим дням недели. Красный трек — факт ниже ожидания к текущему дню более чем на 2%.',
  };
}

function hasRevenuePlan(
  data: Pick<DashboardApi, 'revenueByDay' | 'revenueByMonth'> | object,
): boolean {
  const days = 'revenueByDay' in data ? (data as DashboardApi).revenueByDay : null;
  if (days?.some((day) => day.plan != null)) return true;
  const months = 'revenueByMonth' in data ? (data as DashboardApi).revenueByMonth : null;
  return Boolean(months?.some((month) => month.plan != null));
}

function buildFoodcostMini(
  units: UnitSums[],
  period: { year: number; month: number },
): DashboardData['foodcostMini'] {
  const kbw = units.filter((u) => KBW.includes(u.key as CategoryKey));
  const cost = kbw.reduce((sum, u) => sum + u.cost, 0);
  const revenue = kbw.reduce((sum, u) => sum + u.revenue, 0);
  const pct = revenue ? (cost / revenue) * 100 : 0;
  const scale = foodcostGaugeScale(pct, null);

  return {
    caption: foodcostMiniCaption(period.year, period.month),
    pct,
    goal: null,
    deltaPP: null,
    dir: null,
    scaleMin: scale.min,
    scaleMax: scale.max,
    units: KBW.map((key) => ({
      key,
      name: CAT_NAME[key],
      deltaPP: null,
      dir: null,
    })),
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

/** Собирает «Остаток на складе» из view-model GET /api/stock/snapshot. */
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

/** DashboardApi → DashboardData. */
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
  const maxRevenue = chartSeriesMaxValue(revenueDays);
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
      ? buildDashboardFoodcostMini(
          options.foodcost.units,
          options.foodcost.totals,
          options.foodcost.period,
        )
      : buildFoodcostMini(data.units, period),
    categories: buildCategories(data.units),
    categoriesCaption: categoriesCaption(granularity),
    stock: options.stock ?? data.stock,
    details: {},
  };
}

/** KPI-слой — зависит от compare overlay. */
export function buildDashboardKpiLayer(
  data: Pick<DashboardApi, 'kpis' | 'compare' | 'weekKpi' | 'period'> &
    Partial<Pick<DashboardApi, 'revenueByDay' | 'revenueByMonth'>>,
  options: DashboardViewModelOptions = {},
): Pick<DashboardData, 'kpis' | 'details' | 'period'> {
  const { kpis, compare, period } = data;
  const granularity = options.granularity ?? 'month';
  const weekKpi = options.weekKpi ?? data.weekKpi ?? null;
  const isWeekMode = granularity === 'week' && weekKpi != null;
  const weekFooters = isWeekMode ? buildWeekKpiFooters(data as DashboardApi, weekKpi) : null;
  const showLfl = granularity !== 'year';
  const revenueFromPlan = hasRevenuePlan(data);

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
    'rev-goal': buildGoalPopover(
      revenueFromPlan ? 'План — выручка' : 'Прогноз — выручка',
      kpis.revenue,
      formatMoney,
      granularity,
      revenueFromPlan,
    ),
    'check-goal': buildGoalPopover('Прогноз — средний чек', kpis.avgCheck, formatMoney, granularity),
    'guests-goal': buildGoalPopover(
      'Прогноз — чеки',
      kpis.checks,
      (n) => Math.round(n).toLocaleString('ru-RU'),
      granularity,
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
          ...forecastBlock(
            kpis.revenue,
            (n) => `${(n / 1e6).toFixed(1).replace('.', ',')} млн`,
            granularity,
            revenueFromPlan,
          ),
        },
      },
      avgCheck: {
        value: kpis.avgCheck.value,
        lfl: showLfl ? (checkLfl ?? undefined) : undefined,
        comparisonLabel: showLfl ? 'LfL' : undefined,
        perGuest: kpis.guests.value ? kpis.revenue.value / kpis.guests.value : 0,
        qualityFlag: false,
        weekFooter: weekFooters?.avgCheckWeekFooter,
        forecast: forecastBlock(kpis.avgCheck, formatMoney, granularity),
      },
      guests: {
        value: kpis.checks.value,
        lfl: showLfl ? (checksLfl ?? undefined) : undefined,
        comparisonLabel: showLfl ? 'LfL' : undefined,
        guests: kpis.guests.value,
        perCheck: kpis.checks.value ? kpis.guests.value / kpis.checks.value : 0,
        weekFooter: weekFooters?.checksWeekFooter,
        forecast: forecastBlock(kpis.checks, (n) => Math.round(n).toLocaleString('ru-RU'), granularity),
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

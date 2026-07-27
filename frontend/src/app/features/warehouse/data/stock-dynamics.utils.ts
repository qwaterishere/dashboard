import { CAT_COLOR } from '../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../shared/models';
import type { WarehouseDynamicsPoint } from '../../../shared/models/warehouse-api.model';
import { parseIsoDate } from '../../../shared/utils/iso-date.utils';

export type StockDynamicsFreq = 'day' | 'week' | 'month';

/** Дефолтное / макс. число шагов оси в режимах week/month (legacy helpers). */
export const STOCK_DYNAMICS_AXIS_STEPS = 30;

/** Глубина сырых слепков (~30 месяцев). */
export const STOCK_DYNAMICS_LOOKBACK_DAYS = STOCK_DYNAMICS_AXIS_STEPS * 31;

export const STOCK_CHART_WIDTH = 900;
export const STOCK_CHART_HEIGHT = 280;
export const STOCK_CHART_PAD_LEFT = 70;
export const STOCK_CHART_PAD_RIGHT = 24;
export const STOCK_CHART_PAD_TOP = 20;
export const STOCK_CHART_PAD_BOTTOM = 42;

/** Видимое окно по умолчанию — 30 дней. */
export const STOCK_DYNAMICS_DEFAULT_SPAN_DAYS = 30;
export const STOCK_DYNAMICS_MIN_SPAN_DAYS = 14;
export const STOCK_DYNAMICS_MAX_SPAN_DAYS = STOCK_DYNAMICS_LOOKBACK_DAYS;

export interface StockChartGridLine {
  y: number;
  label: string;
}

export interface StockChartDot {
  cx: number;
  cy: number;
}

export interface StockChartXLabel {
  x: number;
  text: string;
}

export interface StockChartLayout {
  width: number;
  height: number;
  color: string;
  empty: boolean;
  gridLines: StockChartGridLine[];
  polylineSegments: string[];
  areaSegments: string[];
  dots: StockChartDot[];
  /** Маркер выбранного дня слепка (датафрейм), если попадает в окно. */
  selectedDot: StockChartDot | null;
  xLabels: StockChartXLabel[];
  /** Полоса оси дат (hit-zone zoom). */
  axisBandY: number;
  /** Клип plot-зоны (линия режется по краям, не по крайним точкам). */
  plotClip: { x: number; y: number; width: number; height: number };
}

const W = STOCK_CHART_WIDTH;
const H = STOCK_CHART_HEIGHT;
const PL = STOCK_CHART_PAD_LEFT;
const PR = STOCK_CHART_PAD_RIGHT;
const PT = STOCK_CHART_PAD_TOP;
const PB = STOCK_CHART_PAD_BOTTOM;

const MS_PER_DAY = 86_400_000;
/** Минимальный зазор между соседними подписями оси, SVG px. */
const MIN_AXIS_LABEL_GAP_PX = 22;
/** Ширина plot-области (для плотности подписей). */
const PLOT_INNER_WIDTH = W - PL - PR;

const MONTH_SHORT = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

/** Шаг дневных подписей: 0 = только 1-е числа (месяц), иначе каждый N-й день. */
export type AxisDayLabelStep = 0 | 1 | 3 | 7;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Непрерывный день (UTC noon-safe через UTC midnight). */
export function isoToDayNumber(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function dayNumberToIso(day: number): string {
  const date = new Date(Math.round(day) * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

function formatMonthShortFromDay(day: number): string {
  return MONTH_SHORT.format(parseIsoDate(dayNumberToIso(day))).replace('.', '');
}

function utcParts(day: number): { year: number; month: number; dayOfMonth: number } {
  const date = new Date(Math.round(day) * MS_PER_DAY);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    dayOfMonth: date.getUTCDate(),
  };
}

function utcDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Плотность дневных подписей по px/день.
 * Мало места → только названия месяцев на 1-е;
 * больше → каждый 7 / 3 / каждый день.
 */
export function resolveAxisDayLabelStep(
  spanDays: number,
  plotWidth = PLOT_INNER_WIDTH,
): AxisDayLabelStep {
  const pxPerDay = plotWidth / Math.max(spanDays, 1e-6);
  // Если даже шаг «раз в 7 дней» не помещается — только месяцы.
  if (pxPerDay * 7 < MIN_AXIS_LABEL_GAP_PX + 4) return 0;
  if (pxPerDay * 3 < MIN_AXIS_LABEL_GAP_PX + 2) return 7;
  if (pxPerDay < MIN_AXIS_LABEL_GAP_PX - 2) return 3;
  return 1;
}

/**
 * Число слишком близко к границе месяца (подпись месяца),
 * если расстояние до 1-го числа меньше текущего шага.
 */
export function isDayLabelTooCloseToMonth(
  dayOfMonth: number,
  daysInMonth: number,
  step: AxisDayLabelStep,
): boolean {
  if (step <= 0) return true;
  const distFromMonthStart = dayOfMonth - 1;
  const distToNextMonth = daysInMonth - dayOfMonth + 1;
  return distFromMonthStart < step || distToNextMonth < step;
}

/**
 * Размер бакета объединения точек при сильном отдалении (дни).
 * 1 = без объединения.
 */
export function resolvePointMergeBucketDays(
  spanDays: number,
  plotWidth = PLOT_INNER_WIDTH,
): number {
  const pxPerDay = plotWidth / Math.max(spanDays, 1e-6);
  if (pxPerDay >= 3.5) return 1;
  if (pxPerDay >= 1.2) return 7;
  return 30;
}

function storeSum(point: WarehouseDynamicsPoint, store: CategoryKey | 'all'): number {
  if (store === 'all') {
    return point.byStore.reduce((acc, row) => acc + row.value, 0);
  }
  return point.byStore.find((row) => row.key === store)?.value ?? 0;
}

/** Подписи оси: только формат, не агрегация серии. */
export function resolveDynamicsFreq(spanDays: number): StockDynamicsFreq {
  if (spanDays <= 45) return 'day';
  if (spanDays <= 240) return 'week';
  return 'month';
}

/** Непрерывный span — без округления к целым дням. */
export function clampSpanDays(spanDays: number): number {
  return clamp(spanDays, STOCK_DYNAMICS_MIN_SPAN_DAYS, STOCK_DYNAMICS_MAX_SPAN_DAYS);
}

/**
 * Правый край окна: continuous day number.
 * Окно — полуинтервал (end − span, end].
 */
export function clampRangeEndDay(
  rangeEndDay: number,
  spanDays: number,
  asOf: string,
  earliest: string | null,
): number {
  const asOfDay = isoToDayNumber(asOf);
  let end = Math.min(rangeEndDay, asOfDay);
  if (earliest) {
    const minEnd = isoToDayNumber(earliest) + spanDays;
    if (end < minEnd) end = Math.min(minEnd, asOfDay);
  }
  return end;
}

function formatAxisMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}м`;
  }
  if (abs >= 1000) {
    return `${Math.round(value / 1000)}к`;
  }
  return `${Math.round(value)}`;
}

const EMPTY_LAYOUT: StockChartLayout = {
  width: W,
  height: H,
  color: '#6E6BFF',
  empty: true,
  gridLines: [],
  polylineSegments: [],
  areaSegments: [],
  dots: [],
  selectedDot: null,
  xLabels: [],
  axisBandY: H - PB,
  plotClip: { x: PL, y: PT, width: W - PL - PR, height: H - PT - PB },
};

function buildPathSegments(
  samples: Array<{ x: number; y: number }>,
  baseline: number,
): { polylines: string[]; areas: string[] } {
  if (samples.length === 0) return { polylines: [], areas: [] };

  const pts = samples.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`);
  const polylines = [pts.join(' ')];

  if (samples.length === 1) {
    const { x, y } = samples[0];
    return {
      polylines,
      areas: [
        `${x - 8},${baseline} ${x - 8},${y.toFixed(1)} ${x + 8},${y.toFixed(1)} ${x + 8},${baseline}`,
      ],
    };
  }

  const x0 = samples[0].x;
  const x1 = samples[samples.length - 1].x;
  return {
    polylines,
    areas: [`${x0},${baseline} ${pts.join(' ')} ${x1},${baseline}`],
  };
}

function isMonthAxisLabel(text: string): boolean {
  return !/^\d+$/.test(text);
}

/** Убрать пересечения: месяц важнее числа. */
function filterAxisLabelGaps(labels: StockChartXLabel[]): StockChartXLabel[] {
  const out: StockChartXLabel[] = [];
  for (const label of labels) {
    const prev = out.at(-1);
    if (!prev || label.x - prev.x >= MIN_AXIS_LABEL_GAP_PX) {
      out.push(label);
      continue;
    }
    const currMonth = isMonthAxisLabel(label.text);
    const prevMonth = isMonthAxisLabel(prev.text);
    if (currMonth && !prevMonth) {
      out[out.length - 1] = label;
    }
  }
  return out;
}

/**
 * Подписи оси: 1-е число → краткое имя месяца; остальные → число дня
 * с шагом 7 / 3 / 1 в зависимости от масштаба (или только месяцы).
 * Числа у границы месяца (ближе шага) не показываем.
 */
export function buildAxisDateLabels(
  startDay: number,
  endDay: number,
  spanDays: number,
  xAt: (day: number) => number,
): StockChartXLabel[] {
  const step = resolveAxisDayLabelStep(spanDays);
  const from = Math.ceil(startDay - 1e-9);
  const to = Math.floor(endDay + 1e-9);
  if (to < from) return [];

  const labels: StockChartXLabel[] = [];
  for (let day = from; day <= to; day++) {
    const { year, month, dayOfMonth } = utcParts(day);
    if (dayOfMonth === 1) {
      labels.push({ x: xAt(day), text: formatMonthShortFromDay(day) });
      continue;
    }
    if (step === 0) continue;
    if (dayOfMonth % step !== 0) continue;
    const dim = utcDaysInMonth(year, month);
    if (isDayLabelTooCloseToMonth(dayOfMonth, dim, step)) continue;
    labels.push({ x: xAt(day), text: String(dayOfMonth) });
  }
  return filterAxisLabelGaps(labels);
}

/** Объединить слепки в бакеты: последняя точка бакета. */
export function mergeSamplesByBucket(
  samples: ReadonlyArray<{ day: number; value: number }>,
  bucketDays: number,
): Array<{ day: number; value: number }> {
  if (bucketDays <= 1 || samples.length === 0) return [...samples];

  const out: Array<{ day: number; value: number }> = [];
  let bucketKey = Number.NaN;
  let last: { day: number; value: number } | null = null;

  const keyOf = (day: number): number => {
    if (bucketDays >= 28) {
      const { year, month } = utcParts(day);
      return year * 12 + month;
    }
    // Недельные бакеты от фиксированной эпохи (пн-подобные группы по 7 дней).
    return Math.floor(day / bucketDays);
  };

  for (const sample of samples) {
    const key = keyOf(sample.day);
    if (last && key !== bucketKey) {
      out.push(last);
      last = null;
    }
    bucketKey = key;
    last = sample;
  }
  if (last) out.push(last);
  return out;
}

/**
 * Точки внутри окна + по одной за левой/правой границей —
 * чтобы линия уходила за край и клипалась по plot-зоне.
 */
export function selectWindowSamplesWithOverflow(
  samples: ReadonlyArray<{ day: number; value: number }>,
  startDay: number,
  endDay: number,
): {
  visible: Array<{ day: number; value: number }>;
  path: Array<{ day: number; value: number }>;
} {
  let leftOverflow: { day: number; value: number } | null = null;
  const visible: Array<{ day: number; value: number }> = [];
  let rightOverflow: { day: number; value: number } | null = null;

  for (const sample of samples) {
    if (sample.day < startDay) {
      leftOverflow = sample;
      continue;
    }
    if (sample.day > endDay) {
      rightOverflow = sample;
      break;
    }
    visible.push(sample);
  }

  const path = [
    ...(leftOverflow ? [leftOverflow] : []),
    ...visible,
    ...(rightOverflow ? [rightOverflow] : []),
  ];
  return { visible, path };
}

/**
 * Непрерывная ось времени: слепки на реальных датах внутри окна.
 * При сильном отдалении точки объединяются в бакеты.
 * Линия строится с overflow-точками и клипается по plot-зоне.
 * @param selectedDate ISO выбранного слепка — отдельный маркер на графике.
 */
export function buildContinuousStockLayout(
  points: readonly WarehouseDynamicsPoint[],
  store: CategoryKey | 'all',
  rangeEndDay: number,
  spanDays: number,
  selectedDate: string | null = null,
): StockChartLayout {
  const color = store === 'all' ? '#6E6BFF' : CAT_COLOR[store];
  const span = Math.max(spanDays, 1e-6);
  const startDay = rangeEndDay - span;
  const endDay = rangeEndDay;
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const plotClip = { x: PL, y: PT, width: iw, height: ih };

  const allRaw = points
    .map((point) => ({
      day: isoToDayNumber(point.date),
      value: storeSum(point, store),
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => a.day - b.day);

  const bucketDays = resolvePointMergeBucketDays(span);
  const allMerged = mergeSamplesByBucket(allRaw, bucketDays);
  const { visible, path } = selectWindowSamplesWithOverflow(
    allMerged,
    startDay,
    endDay,
  );

  if (visible.length === 0 && path.length === 0) {
    return { ...EMPTY_LAYOUT, color, plotClip };
  }
  // В окне пусто, но есть только overflow — нечего показывать.
  if (visible.length === 0) {
    return { ...EMPTY_LAYOUT, color, plotClip };
  }

  const numeric = path.map((s) => s.value);
  const rawMax = Math.max(...numeric);
  const rawMin = Math.min(...numeric);
  const pad = Math.max((rawMax - rawMin) * 0.08, Math.abs(rawMax) * 0.04, 1);
  const max = rawMax + pad;
  const min = Math.max(0, rawMin - pad);
  const ySpan = max - min || 1;

  const xAt = (day: number) => PL + ((day - startDay) / span) * iw;
  const yAt = (v: number) => PT + ih - ((v - min) / ySpan) * ih;
  const baseline = PT + ih;

  const gridLines: StockChartGridLine[] = [];
  for (let i = 0; i <= 4; i++) {
    const gy = PT + (ih * i) / 4;
    const gv = max - (ySpan * i) / 4;
    gridLines.push({ y: gy, label: formatAxisMoney(gv) });
  }

  const gapLimit = Math.max(1.5, bucketDays * 1.5);
  const polylines: string[] = [];
  const areas: string[] = [];
  let run: Array<{ x: number; y: number; day: number }> = [];
  const flushRun = () => {
    if (run.length === 0) return;
    const { polylines: p, areas: a } = buildPathSegments(run, baseline);
    polylines.push(...p);
    areas.push(...a);
    run = [];
  };
  for (const sample of path) {
    const prev = run.at(-1);
    if (prev && sample.day - prev.day > gapLimit) flushRun();
    run.push({ x: xAt(sample.day), y: yAt(sample.value), day: sample.day });
  }
  flushRun();

  const selectedDay = selectedDate ? isoToDayNumber(selectedDate) : null;
  const selectedSample =
    selectedDay !== null
      ? allRaw.find((s) => s.day === selectedDay) ?? null
      : null;
  const selectedInView =
    selectedSample !== null &&
    selectedSample.day >= startDay &&
    selectedSample.day <= endDay;
  const selectedDot: StockChartDot | null = selectedInView
    ? { cx: xAt(selectedSample.day), cy: yAt(selectedSample.value) }
    : null;

  // Обычные точки — внутри окна; день датафрейма рисуется отдельным маркером.
  const dots: StockChartDot[] = visible
    .filter((s) => selectedDay === null || s.day !== selectedDay)
    .map((s) => ({
      cx: xAt(s.day),
      cy: yAt(s.value),
    }));

  return {
    width: W,
    height: H,
    color,
    empty: false,
    gridLines,
    polylineSegments: polylines,
    areaSegments: areas,
    dots,
    selectedDot,
    xLabels: buildAxisDateLabels(startDay, endDay, span, xAt),
    axisBandY: H - PB,
    plotClip,
  };
}

export function clientToSvgPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / Math.max(rect.width, 1)) * W,
    y: ((clientY - rect.top) / Math.max(rect.height, 1)) * H,
  };
}

export function hitChartZone(
  svgX: number,
  svgY: number,
): 'plot' | 'axis' | 'none' {
  if (svgX < 0 || svgX > W || svgY < 0 || svgY > H) return 'none';
  if (svgY >= H - PB - 14) return 'axis';
  return 'plot';
}

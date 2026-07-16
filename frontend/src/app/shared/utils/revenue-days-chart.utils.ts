import type { ChartDisplayMode, PeriodGranularity } from '../models/common.model';
import type { RevenueDay } from '../models';

/** Значение горизонтальной засечки: только план из раздела «Цели» (не статистический прогноз). */
export function barPlanValue(day: RevenueDay): number | null {
  const plan = day.plan;
  return plan !== null && plan > 0 ? plan : null;
}

/** @deprecated Используйте barPlanValue */
export const barMarkValue = barPlanValue;

export interface RevenueDayBarLayout {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Y горизонтальной засечки плана; 0 если плана нет. */
  markY: number;
  /** Центр столбца по X — для вертикали от засечки к нулю. */
  markX: number;
  /** Y нулевой линии (база столбцов). */
  baselineY: number;
  hasMark: boolean;
  labelX: number;
  label: string;
  weekend: boolean;
  day: RevenueDay;
}

export interface RevenueDaysChartLayout {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  gridLines: { y: number; label: string }[];
  bars: RevenueDayBarLayout[];
}

const CHART_WIDTH = 860;
const CHART_HEIGHT = 230;
const PADDING = { left: 46, right: 10, top: 14, bottom: 28 };

/** Округлить до 1 знака (как legacy dashboard.js r1). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatBarLabel(
  day: RevenueDay,
  displayMode: ChartDisplayMode,
  timeframe: PeriodGranularity,
): string {
  if (day.barLabel) return day.barLabel;
  if (displayMode === 'month' || displayMode === 'quarter') {
    return String(day.day);
  }
  if (displayMode === 'day' && timeframe === 'month') {
    return String(day.day);
  }
  const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'] as const;
  return `${day.day} ${weekdays[day.weekday]}`;
}

export function buildRevenueDaysChartLayout(
  days: RevenueDay[],
  max: number,
  displayMode: ChartDisplayMode = 'day',
  timeframe: PeriodGranularity = 'week',
): RevenueDaysChartLayout {
  const iw = CHART_WIDTH - PADDING.left - PADDING.right;
  const ih = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const slot = iw / days.length;
  const baselineY = PADDING.top + ih;

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const y = PADDING.top + ih - (ih * i) / 4;
    const label = `${Math.round((max * i) / 4 / 1000).toLocaleString('ru-RU')}к`;
    return { y, label };
  });

  const bars = days.map((day, index) => {
    const h = (day.revenue / max) * ih;
    const x = PADDING.left + slot * index + slot * 0.2;
    const w = slot * 0.6;
    const y = baselineY - h;
    const mark = barPlanValue(day);
    // Пустые будущие столбцы (нет факта) — без засечек и вертикали плана.
    const hasMark = mark !== null && day.revenue > 0;
    const markY = hasMark ? baselineY - (mark / max) * ih : 0;
    const markX = x + w / 2;
    const labelX = PADDING.left + slot * index + slot / 2;
    const weekend = displayMode === 'day' && (day.weekday === 0 || day.weekday === 6);

    return {
      index,
      x: round1(x),
      y: round1(y),
      w: round1(w),
      h: round1(h),
      markY: round1(markY),
      markX: round1(markX),
      baselineY: round1(baselineY),
      hasMark,
      labelX: round1(labelX),
      label: formatBarLabel(day, displayMode, timeframe),
      weekend,
      day,
    };
  });

  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    paddingLeft: PADDING.left,
    paddingRight: PADDING.right,
    paddingTop: PADDING.top,
    paddingBottom: PADDING.bottom,
    gridLines,
    bars,
  };
}

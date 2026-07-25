import { describeArc, shade } from './chart.utils';

export interface DonutSliceInput {
  key: string;
  color: string;
  value: number;
}

export interface DonutSliceLayout {
  key: string;
  path: string;
  gradientId: string;
  color: string;
  shadedColor: string;
}

export interface DonutChartLayoutOptions {
  cx?: number;
  cy?: number;
  r?: number;
  strokeWidth?: number;
  gap?: number;
  /** Префикс SVG id — чтобы несколько donut на одной странице не конфликтовали. */
  idPrefix?: string;
}

export const DONUT_LAYOUT_DEFAULT = { cx: 110, cy: 110, r: 82, strokeWidth: 30, gap: 1.2 };
export const DONUT_LAYOUT_COMPACT = { cx: 95, cy: 95, r: 70, strokeWidth: 26, gap: 1.2 };
/** Мини-карточки дашборда (~120px). */
export const DONUT_LAYOUT_MINI = { cx: 60, cy: 60, r: 44, strokeWidth: 16, gap: 1.5 };

const DEFAULTS = { ...DONUT_LAYOUT_DEFAULT, idPrefix: 'donut' };

export interface DonutChartLayout {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  innerShadeId: string;
  slices: DonutSliceLayout[];
}

/** SVG-сегменты пончика (sales + warehouse + dashboard mini). */
export function buildDonutChartLayout(
  slices: DonutSliceInput[],
  options: DonutChartLayoutOptions = {},
): DonutChartLayout {
  const { cx, cy, r, strokeWidth, gap, idPrefix } = { ...DEFAULTS, ...options };
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const innerShadeId = `${idPrefix}-inner-shade`;

  if (!total) {
    return { cx, cy, r, strokeWidth, innerShadeId, slices: [] };
  }

  let angle = 0;
  const layouts: DonutSliceLayout[] = [];

  slices.forEach((slice, index) => {
    const sweep = (slice.value / total) * 360;
    const start = angle;
    const end = angle + sweep - (slices.length > 1 ? gap : 0);
    angle += sweep;

    layouts.push({
      key: slice.key,
      path: describeArc(cx, cy, r, start, end),
      gradientId: `${idPrefix}-g-${index}`,
      color: slice.color,
      shadedColor: shade(slice.color, -30),
    });
  });

  return { cx, cy, r, strokeWidth, innerShadeId, slices: layouts };
}

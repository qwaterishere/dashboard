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

export interface DonutChartLayout {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  slices: DonutSliceLayout[];
}

export const DONUT_LAYOUT_DEFAULT = { cx: 110, cy: 110, r: 82, strokeWidth: 30, gap: 1.2 };
export const DONUT_LAYOUT_COMPACT = { cx: 95, cy: 95, r: 70, strokeWidth: 26, gap: 1.2 };

const DEFAULTS = DONUT_LAYOUT_DEFAULT;

/** SVG-сегменты пончика (sales + warehouse). */
export function buildDonutChartLayout(
  slices: DonutSliceInput[],
  options: Partial<typeof DEFAULTS> = {},
): DonutChartLayout {
  const { cx, cy, r, strokeWidth, gap } = { ...DEFAULTS, ...options };
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (!total) {
    return { cx, cy, r, strokeWidth, slices: [] };
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
      gradientId: `donut-g-${index}`,
      color: slice.color,
      shadedColor: shade(slice.color, -30),
    });
  });

  return { cx, cy, r, strokeWidth, slices: layouts };
}

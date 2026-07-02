import { CAT_COLOR } from '../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../shared/models';

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
  gridLines: StockChartGridLine[];
  areaPoints: string;
  polylinePoints: string;
  dots: StockChartDot[];
  xLabels: StockChartXLabel[];
}

const W = 900;
const H = 280;
const PL = 70;
const PR = 20;
const PT = 20;
const PB = 34;

/** SVG-разметка линейного графика динамики запасов (legacy warehouse.js). */
export function buildStockChartLayout(
  labels: string[],
  values: number[],
  store: CategoryKey | 'all',
): StockChartLayout {
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const max = Math.max(...values) * 1.1;
  const min = Math.min(...values) * 0.85;
  const span = max - min || 1;

  const x = (i: number) => PL + (iw * i) / (values.length - 1);
  const y = (v: number) => PT + ih - ((v - min) / span) * ih;

  const gridLines: StockChartGridLine[] = [];
  for (let i = 0; i <= 4; i++) {
    const gy = PT + (ih * i) / 4;
    const gv = max - (span * i) / 4;
    gridLines.push({ y: gy, label: `${Math.round(gv / 1000)}к` });
  }

  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const areaPoints = `${PL},${PT + ih} ${pts.join(' ')} ${W - PR},${PT + ih}`;
  const polylinePoints = pts.join(' ');
  const dots = values.map((v, i) => ({ cx: x(i), cy: y(v) }));
  const xLabels = labels.map((text, i) => ({ x: x(i), text }));

  return {
    width: W,
    height: H,
    color: store === 'all' ? '#6E6BFF' : CAT_COLOR[store],
    gridLines,
    areaPoints,
    polylinePoints,
    dots,
    xLabels,
  };
}

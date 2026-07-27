import {
  buildAxisDateLabels,
  buildContinuousStockLayout,
  clampRangeEndDay,
  clampSpanDays,
  hitChartZone,
  isDayLabelTooCloseToMonth,
  isoToDayNumber,
  mergeSamplesByBucket,
  resolveAxisDayLabelStep,
  resolveDynamicsFreq,
  resolvePointMergeBucketDays,
  selectWindowSamplesWithOverflow,
  STOCK_CHART_HEIGHT,
  STOCK_CHART_PAD_LEFT,
} from './stock-dynamics.utils';
import type { WarehouseDynamicsPoint } from '../../../shared/models/warehouse-api.model';

const points: WarehouseDynamicsPoint[] = [
  {
    date: '2026-07-01',
    byStore: [
      { key: 'k', value: 90_000 },
      { key: 'b', value: 40_000 },
      { key: 'w', value: 20_000 },
    ],
  },
  {
    date: '2026-07-02',
    byStore: [
      { key: 'k', value: 91_000 },
      { key: 'b', value: 41_000 },
      { key: 'w', value: 20_000 },
    ],
  },
  {
    date: '2026-07-06',
    byStore: [
      { key: 'k', value: 100_000 },
      { key: 'b', value: 50_000 },
      { key: 'w', value: 25_000 },
    ],
  },
  {
    date: '2026-07-28',
    byStore: [
      { key: 'k', value: 105_000 },
      { key: 'b', value: 52_000 },
      { key: 'w', value: 26_000 },
    ],
  },
  {
    date: '2026-08-01',
    byStore: [
      { key: 'k', value: 110_000 },
      { key: 'b', value: 55_000 },
      { key: 'w', value: 30_000 },
    ],
  },
];

describe('stock-dynamics.utils', () => {
  it('resolveDynamicsFreq switches day → week → month by span', () => {
    expect(resolveDynamicsFreq(30)).toBe('day');
    expect(resolveDynamicsFreq(120)).toBe('week');
    expect(resolveDynamicsFreq(400)).toBe('month');
  });

  it('resolveAxisDayLabelStep densifies with zoom', () => {
    expect(resolveAxisDayLabelStep(900)).toBe(0);
    expect(resolveAxisDayLabelStep(120)).toBe(7);
    expect(resolveAxisDayLabelStep(45)).toBe(3);
    expect(resolveAxisDayLabelStep(20)).toBe(1);
  });

  it('hides day numbers too close to month boundary vs step', () => {
    expect(isDayLabelTooCloseToMonth(7, 31, 7)).toBe(true);
    expect(isDayLabelTooCloseToMonth(14, 31, 7)).toBe(false);
    expect(isDayLabelTooCloseToMonth(28, 31, 7)).toBe(true);
    expect(isDayLabelTooCloseToMonth(30, 31, 3)).toBe(true);
    expect(isDayLabelTooCloseToMonth(27, 31, 3)).toBe(false);
  });

  it('axis: month name on the 1st; skips numbers near month edge', () => {
    const start = isoToDayNumber('2026-07-01');
    const span = 45; // step = 3
    const end = start + span;
    const plotW = 806;
    const xAt = (d: number) => ((d - start) / span) * plotW;
    const labels = buildAxisDateLabels(start, end, span, xAt);
    const month = labels.find((l) => Math.abs(l.x - xAt(start)) < 0.5);
    expect(month?.text).toMatch(/июл/i);
    expect(labels.some((l) => l.text === '1')).toBe(false);
    expect(labels.some((l) => l.text === '30')).toBe(false);
    expect(labels.some((l) => l.text === '3')).toBe(false); // близко к 1-му
    expect(labels.some((l) => l.text === '15' || l.text === '18' || l.text === '21')).toBe(
      true,
    );
  });

  it('axis: months only when span is wide', () => {
    const start = isoToDayNumber('2026-01-01');
    const end = isoToDayNumber('2026-12-31');
    const span = end - start;
    const plotW = 806;
    const xAt = (d: number) => ((d - start) / span) * plotW;
    const labels = buildAxisDateLabels(start, end, span, xAt);
    expect(labels.every((l) => !/^\d+$/.test(l.text))).toBe(true);
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('places a dot for every daily snapshot when zoomed in', () => {
    const end = isoToDayNumber('2026-07-14');
    const layout = buildContinuousStockLayout(points, 'all', end, 30);
    expect(layout.empty).toBe(false);
    expect(layout.dots).toHaveLength(3);
  });

  it('merges points when strongly zoomed out', () => {
    expect(resolvePointMergeBucketDays(30)).toBe(1);
    expect(resolvePointMergeBucketDays(400)).toBeGreaterThan(1);

    const daily = Array.from({ length: 60 }, (_, i) => ({
      day: isoToDayNumber('2026-01-01') + i,
      value: 1000 + i,
    }));
    const merged = mergeSamplesByBucket(daily, 7);
    expect(merged.length).toBeLessThan(daily.length);
    expect(merged.length).toBeGreaterThanOrEqual(8);
  });

  it('excludes points outside continuous window', () => {
    const end = isoToDayNumber('2026-07-03');
    const layout = buildContinuousStockLayout(points, 'all', end, 3);
    expect(layout.empty).toBe(false);
    expect(layout.dots).toHaveLength(2);
  });

  it('includes overflow samples for path continuity beyond window', () => {
    const samples = [
      { day: 10, value: 1 },
      { day: 11, value: 2 },
      { day: 12, value: 3 },
      { day: 13, value: 4 },
      { day: 14, value: 5 },
    ];
    const { visible, path } = selectWindowSamplesWithOverflow(samples, 11.5, 13.2);
    expect(visible.map((s) => s.day)).toEqual([12, 13]);
    expect(path.map((s) => s.day)).toEqual([11, 12, 13, 14]);
  });

  it('clips plot zone to pad box', () => {
    const end = isoToDayNumber('2026-07-14');
    const layout = buildContinuousStockLayout(points, 'all', end, 30);
    expect(layout.plotClip.x).toBe(STOCK_CHART_PAD_LEFT);
    expect(layout.plotClip.width).toBeGreaterThan(0);
    expect(layout.polylineSegments.length).toBeGreaterThanOrEqual(1);
  });

  it('marks selected dataframe day when in view', () => {
    const end = isoToDayNumber('2026-07-14');
    const layout = buildContinuousStockLayout(
      points,
      'all',
      end,
      30,
      '2026-07-06',
    );
    expect(layout.selectedDot).not.toBeNull();
    expect(layout.dots.every((d) => d.cx !== layout.selectedDot!.cx || d.cy !== layout.selectedDot!.cy)).toBe(
      true,
    );
  });

  it('hides selected marker when day is outside window', () => {
    const end = isoToDayNumber('2026-07-03');
    const layout = buildContinuousStockLayout(
      points,
      'all',
      end,
      3,
      '2026-08-01',
    );
    expect(layout.selectedDot).toBeNull();
  });

  it('clampSpanDays is continuous (no integer snap)', () => {
    expect(clampSpanDays(5)).toBe(14);
    expect(clampSpanDays(30.25)).toBe(30.25);
    expect(clampSpanDays(9999)).toBe(930);
  });

  it('clampRangeEndDay respects asOf and earliest', () => {
    const asOf = '2026-07-20';
    const earliest = '2026-07-01';
    const end = clampRangeEndDay(isoToDayNumber('2026-08-01'), 30, asOf, earliest);
    expect(end).toBe(isoToDayNumber(asOf));

    const tooLeft = clampRangeEndDay(isoToDayNumber('2026-07-05'), 30, asOf, earliest);
    expect(tooLeft).toBe(isoToDayNumber(asOf));

    const short = clampRangeEndDay(isoToDayNumber('2026-07-05'), 10, asOf, earliest);
    expect(short).toBe(isoToDayNumber(earliest) + 10);
  });

  it('hitChartZone: bottom band is axis, rest is plot', () => {
    expect(hitChartZone(100, STOCK_CHART_HEIGHT - 10)).toBe('axis');
    expect(hitChartZone(100, 100)).toBe('plot');
    expect(hitChartZone(-1, 100)).toBe('none');
  });
});

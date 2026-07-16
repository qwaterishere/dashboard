import { buildRevenueDaysChartLayout, round1 } from './revenue-days-chart.utils';
import type { RevenueDay } from '../models';

const sampleDays: RevenueDay[] = [
  { day: 1, weekday: 1, revenue: 637000, plan: 640000, forecast: null, checks: 306, guests: 704, avg: 2082 },
  { day: 2, weekday: 2, revenue: 623000, plan: 640000, forecast: null, checks: 293, guests: 674, avg: 2126 },
];

describe('revenue-days-chart.utils', () => {
  describe('round1', () => {
    it('rounds to one decimal', () => {
      expect(round1(78.00000001)).toBe(78);
      expect(round1(12.34)).toBe(12.3);
    });
  });

  describe('buildRevenueDaysChartLayout', () => {
    it('builds one bar per day', () => {
      const layout = buildRevenueDaysChartLayout(sampleDays, 1200000);
      expect(layout.bars).toHaveLength(2);
    });

    it('hides mark line when plan is null', () => {
      const days: RevenueDay[] = [
        { day: 1, weekday: 1, revenue: 637000, plan: null, forecast: null, checks: 306, guests: 704, avg: 2082 },
      ];
      const layout = buildRevenueDaysChartLayout(days, 1200000);
      expect(layout.bars[0].hasMark).toBe(false);
    });

    it('does not show mark from statistical forecast alone', () => {
      const days: RevenueDay[] = [
        { day: 1, weekday: 1, revenue: 637000, plan: null, forecast: 640000, checks: 306, guests: 704, avg: 2082 },
      ];
      const layout = buildRevenueDaysChartLayout(days, 1200000);
      expect(layout.bars[0].hasMark).toBe(false);
    });

    it('shows mark line from targets plan with stem to baseline', () => {
      const days: RevenueDay[] = [
        { day: 1, weekday: 1, revenue: 600000, plan: 900000, forecast: 500000, checks: 306, guests: 704, avg: 2082 },
      ];
      const layout = buildRevenueDaysChartLayout(days, 1200000);
      const bar = layout.bars[0];
      expect(bar.hasMark).toBe(true);
      expect(bar.markY).toBeLessThan(bar.baselineY);
      expect(bar.markX).toBe(round1(bar.x + bar.w / 2));
    });

    it('hides mark on empty future bars even when plan is set', () => {
      const days: RevenueDay[] = [
        { day: 20, weekday: 1, revenue: 0, plan: 640000, forecast: null, checks: 0, guests: 0, avg: 0 },
      ];
      const layout = buildRevenueDaysChartLayout(days, 1200000);
      expect(layout.bars[0].hasMark).toBe(false);
    });

    it('marks weekend labels for week timeframe', () => {
      const days: RevenueDay[] = [
        { day: 7, weekday: 0, revenue: 845000, plan: 800000, forecast: null, checks: 389, guests: 895, avg: 2172 },
      ];
      const layout = buildRevenueDaysChartLayout(days, 1200000, 'day', 'week');
      expect(layout.bars[0].weekend).toBe(true);
      expect(layout.bars[0].label).toContain('вс');
    });

    it('uses day number only for month timeframe', () => {
      const days: RevenueDay[] = [
        { day: 7, weekday: 0, revenue: 845000, plan: 800000, forecast: null, checks: 389, guests: 895, avg: 2172 },
      ];
      const layout = buildRevenueDaysChartLayout(days, 1200000, 'day', 'month');
      expect(layout.bars[0].label).toBe('7');
    });

    it('creates five grid lines', () => {
      const layout = buildRevenueDaysChartLayout(sampleDays, 1200000);
      expect(layout.gridLines).toHaveLength(5);
      expect(layout.gridLines[4].label).toContain('200к');
    });
  });
});

import type { ApiPeriod } from '../models/dashboard-api.model';
import type { RevenueDay } from '../models/dashboard.model';
import { buildDayDetailPopover, formatDayPopoverTitle } from './day-detail.utils';

const period: ApiPeriod = { year: 2026, month: 6, dayFrom: 1, dayTo: 30 };

describe('day-detail.utils', () => {
  it('formats title with month and weekday', () => {
    const day: RevenueDay = {
      day: 5,
      weekday: 5,
      revenue: 985_000,
      plan: 940_000,
      forecast: null,
      checks: 474,
      guests: 1090,
      avg: 2078,
    };
    expect(formatDayPopoverTitle(day, period)).toBe('5 июня · пятница');
  });

  it('builds popover rows with plan delta', () => {
    const day: RevenueDay = {
      day: 5,
      weekday: 5,
      revenue: 985_000,
      plan: 940_000,
      forecast: null,
      checks: 474,
      guests: 1090,
      avg: 2078,
    };
    const pop = buildDayDetailPopover(day, period);
    expect(pop.rows[0][0]).toBe('Выручка');
    expect(pop.rows[0][1]).toMatch(/985[\s\u00a0]000 ₽/);
    expect(pop.rows[1][0]).toMatch(/940[\s\u00a0]000 ₽/);
    expect(pop.rows[1][1]).toBe('+4,8 %');
    expect(pop.rows[1][2]).toBe('up');
    expect(pop.rows[2][1]).toMatch(/474 · 2[\s\u00a0]078 ₽/);
    expect(pop.footnoteLink).toBe('/sales');
    expect(pop.footnoteQueryParams).toEqual({
      date_from: '2026-06-05',
      date_to: '2026-06-05',
    });
  });

  it('shows dash when forecast and plan are missing', () => {
    const day: RevenueDay = {
      day: 1,
      weekday: 1,
      revenue: 500,
      plan: null,
      forecast: null,
      checks: 5,
      guests: 10,
      avg: 100,
    };
    const pop = buildDayDetailPopover(day, period);
    expect(pop.rows[1]).toEqual(['К прогнозу дня', '—']);
  });
});

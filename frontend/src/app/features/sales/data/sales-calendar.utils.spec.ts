import {
  buildSalesCalendarCells,
  formatSalesCalendarMonthTitle,
  shiftCalendarMonth,
} from './sales-calendar.utils';

describe('sales-calendar.utils', () => {
  it('builds Monday-first June 2026 grid with range highlight', () => {
    // 2026-06-01 = Monday → no leading pads
    const cells = buildSalesCalendarCells(2026, 6, '2026-06-01', '2026-06-03');
    expect(cells[0]?.iso).toBe('2026-06-01');
    expect(cells[0]?.isStart).toBe(true);
    expect(cells[1]?.inRange).toBe(true);
    expect(cells[2]?.isEnd).toBe(true);
  });

  it('disables days after maxIso', () => {
    const cells = buildSalesCalendarCells(2026, 6, null, null, '2026-06-10');
    const day10 = cells.find((c) => c.iso === '2026-06-10');
    const day11 = cells.find((c) => c.iso === '2026-06-11');
    expect(day10?.disabled).toBe(false);
    expect(day11?.disabled).toBe(true);
  });

  it('shifts calendar month across year boundary', () => {
    expect(shiftCalendarMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftCalendarMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
  });

  it('formats month title', () => {
    expect(formatSalesCalendarMonthTitle(2026, 6)).toBe('июн 2026');
  });
});

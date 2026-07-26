import {
  buildWarehouseCalendarCells,
  formatWarehouseDayLabel,
  parseWarehouseIso,
  shiftWarehouseMonth,
} from './warehouse-period.utils';

describe('warehouse-period.utils', () => {
  it('parseWarehouseIso reads yyyy-mm-dd', () => {
    expect(parseWarehouseIso('2026-07-14')).toEqual({
      year: 2026,
      month: 7,
      day: 14,
    });
    expect(parseWarehouseIso('bad')).toBeNull();
  });

  it('formatWarehouseDayLabel uses ru-RU long date', () => {
    expect(formatWarehouseDayLabel('2026-07-14')).toContain('2026');
  });

  it('shiftWarehouseMonth wraps years', () => {
    expect(shiftWarehouseMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftWarehouseMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
  });

  it('buildWarehouseCalendarCells enables only available dates', () => {
    const available = new Set(['2026-07-01', '2026-07-14']);
    const cells = buildWarehouseCalendarCells(2026, 7, '2026-07-14', available);
    const day1 = cells.find((c) => c.iso === '2026-07-01');
    const day2 = cells.find((c) => c.iso === '2026-07-02');
    const day14 = cells.find((c) => c.iso === '2026-07-14');
    expect(day1?.disabled).toBe(false);
    expect(day2?.disabled).toBe(true);
    expect(day14?.active).toBe(true);
  });
});

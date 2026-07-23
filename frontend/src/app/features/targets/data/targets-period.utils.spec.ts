import {
  currentCalendarMonth,
  formatTargetsMonthLabel,
  parseTargetsAnchorIso,
  targetsYearBounds,
} from './targets-period.utils';

describe('targets-period.utils', () => {
  it('formats nominative month label', () => {
    expect(formatTargetsMonthLabel(2026, 8)).toBe('Август 2026');
  });

  it('parses ISO anchor to year/month', () => {
    expect(parseTargetsAnchorIso('2026-06-10')).toEqual({ year: 2026, month: 6 });
    expect(parseTargetsAnchorIso('bad')).toBeNull();
  });

  it('builds year bounds around anchor', () => {
    expect(targetsYearBounds(2026, 2)).toEqual({ minYear: 2024, maxYear: 2028 });
  });

  it('currentCalendarMonth returns valid month', () => {
    const current = currentCalendarMonth();
    expect(current.month).toBeGreaterThanOrEqual(1);
    expect(current.month).toBeLessThanOrEqual(12);
  });
});

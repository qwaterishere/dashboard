import {
  buildMonthDayPlans,
  daysInMonth,
  monthGridOffset,
  sumMonthDayPlans,
  weekProfileIndex,
} from './targets-revenue-plan.utils';

describe('targets-revenue-plan.utils', () => {
  it('maps weekdays to mon-first profile indices', () => {
    expect(weekProfileIndex(2026, 8, 3)).toBe(0);
    expect(weekProfileIndex(2026, 8, 9)).toBe(6);
  });

  it('distributes month plan across days using week profile', () => {
    const plans = buildMonthDayPlans(2026, 8, 3_100_000, [1, 1, 1, 1, 1, 2, 2]);
    expect(plans).toHaveLength(31);
    expect(sumMonthDayPlans(plans)).toBe(3_100_000);
    const saturday = plans.find((plan) => plan.day === 1);
    const monday = plans.find((plan) => plan.day === 3);
    expect(saturday?.amount).toBeGreaterThan(monday?.amount ?? 0);
  });

  it('keeps overridden days fixed and redistributes the rest', () => {
    const plans = buildMonthDayPlans(
      2026,
      8,
      1_000_000,
      [1, 1, 1, 1, 1, 1, 1],
      { 10: 250_000 },
    );
    expect(plans.find((plan) => plan.day === 10)?.amount).toBe(250_000);
    expect(sumMonthDayPlans(plans)).toBe(1_000_000);
  });

  it('returns correct month length and grid offset', () => {
    expect(daysInMonth(2026, 8)).toBe(31);
    expect(monthGridOffset(2026, 8)).toBe(5);
  });
});

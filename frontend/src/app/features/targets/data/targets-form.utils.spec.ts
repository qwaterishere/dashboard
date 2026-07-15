import { complimentsAmountFromPlan, buildTargetsFormState } from './targets-form.utils';
import type { TargetsData } from '../../../shared/models/targets.model';

const SAMPLE: TargetsData = {
  period: { year: 2026, month: 8, label: 'Август 2026' },
  reference: { label: 'июня (1–12)', revenueFact: 4_600_000, revenuePace: 11_900_000 },
  revenue: { monthPlan: 11_800_000, weekProfile: [1, 1, 1, 1.05, 1.1, 1.2, 1.15] },
  foodcost: [
    { key: 'k', name: 'Кухня', goalPct: 30, factPct: 30.2 },
    { key: 'b', name: 'Бар', goalPct: 24, factPct: 24.7 },
  ],
  writeoffs: [
    { key: 'k', name: 'Кухня', mode: 'pct', pct: 1.2, rub: 138_000 },
    { key: 'b', name: 'Бар', mode: 'pct', pct: 0.8, rub: 92_000 },
  ],
  compliments: { goalPct: 0.4, factPct: 0.4, factRub: 46_000 },
  inventory: { goalPct: 0.15, note: 'факта нет — домен фазы 2' },
};

describe('targets-form.utils', () => {
  it('builds editable form state from API payload', () => {
    const state = buildTargetsFormState(SAMPLE);
    expect(state.revenueMonthPlan).toBe(11_800_000);
    expect(state.weekProfile).toEqual(SAMPLE.revenue.weekProfile);
    expect(state.dailyPlanOverrides).toEqual({});
    expect(state.foodcostGoals['k']).toBe(30);
    expect(state.writeoffs).toHaveLength(2);
  });

  it('computes compliments amount from revenue plan', () => {
    expect(complimentsAmountFromPlan(10_000_000, 0.4)).toBe(40_000);
  });
});

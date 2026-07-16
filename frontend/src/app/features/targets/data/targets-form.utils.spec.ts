import {
  buildTargetsFormState,
  cloneTargetsFormState,
  complimentsAmountFromPlan,
  formStateToUpsertRequest,
  isTargetsFormDirty,
  isTargetsSectionDirty,
  restoreTargetsSection,
} from './targets-form.utils';
import type { TargetsData, TargetsFormState } from '../../../shared/models/targets.model';

const SAMPLE: TargetsData = {
  period: { year: 2026, month: 8, label: 'Август 2026' },
  reference: { label: 'июня (1–12)', revenueFact: 4_600_000, revenuePace: 11_900_000 },
  revenue: { monthPlan: 11_800_000, weekProfile: [1, 1, 1, 1.05, 1.1, 1.2, 1.15] },
  dailyOverrides: { '3': 500_000 },
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
    expect(state.dailyPlanOverrides).toEqual({ 3: 500_000 });
    expect(state.foodcostGoals['k']).toBe(30);
    expect(state.writeoffs).toHaveLength(2);
  });

  it('computes compliments amount from revenue plan', () => {
    expect(complimentsAmountFromPlan(10_000_000, 0.4)).toBe(40_000);
  });

  it('maps form state to upsert payload with daily overrides', () => {
    const form = buildTargetsFormState(SAMPLE);
    form.revenueMonthPlan = 12_000_000;
    form.foodcostGoals['k'] = 29;
    form.dailyPlanOverrides[7] = 400_000;
    const payload = formStateToUpsertRequest(SAMPLE, form);
    expect(payload.year).toBe(2026);
    expect(payload.month).toBe(8);
    expect(payload.revenue.monthPlan).toBe(12_000_000);
    expect(payload.dailyOverrides).toEqual({ '3': 500_000, '7': 400_000 });
    expect(payload.foodcost[0].goalPct).toBe(29);
    expect(payload.complimentsGoalPct).toBe(0.4);
  });

  it('detects section and form dirtiness against saved snapshot', () => {
    const saved = buildTargetsFormState(SAMPLE);
    const current: TargetsFormState = {
      ...cloneTargetsFormState(saved),
      inventoryGoalPct: 0.5,
    };

    expect(isTargetsSectionDirty(current, saved, 'inventory')).toBe(true);
    expect(isTargetsSectionDirty(current, saved, 'revenue')).toBe(false);
    expect(isTargetsFormDirty(current, saved)).toBe(true);
  });

  it('restores only the selected section from saved snapshot', () => {
    const saved = buildTargetsFormState(SAMPLE);
    const dirty = cloneTargetsFormState(saved);
    dirty.revenueMonthPlan = 1;
    dirty.inventoryGoalPct = 9;

    const restored = restoreTargetsSection(dirty, saved, 'revenue');
    expect(restored.revenueMonthPlan).toBe(saved.revenueMonthPlan);
    expect(restored.inventoryGoalPct).toBe(9);
  });
});

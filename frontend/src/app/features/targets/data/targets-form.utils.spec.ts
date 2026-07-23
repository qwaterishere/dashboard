import {
  buildTargetsFormState,
  cloneTargetsFormState,
  complimentsAmountFromPlan,
  formStateToUpsertRequest,
  isTargetsFormDirty,
  isTargetsSectionDirty,
  restoreTargetsSection,
  validateTargetsFormState,
  isTargetsMonthConfigured,
} from './targets-form.utils';
import type { TargetsData, TargetsFormState } from '../../../shared/models/targets.model';

const SAMPLE: TargetsData = {
  period: { year: 2026, month: 8, label: 'Август 2026' },
  reference: { label: 'июля', revenueFact: 4_600_000, revenuePace: 4_600_000 },
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
  locked: false,
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

  it('rejects incomplete form until all required fields are > 0', () => {
    const empty = buildTargetsFormState({
      ...SAMPLE,
      revenue: { monthPlan: 0, weekProfile: [1, 1, 1, 1, 1, 1, 1] },
      foodcost: SAMPLE.foodcost.map((unit) => ({ ...unit, goalPct: 0 })),
      writeoffs: SAMPLE.writeoffs.map((unit) => ({ ...unit, pct: 0, rub: 0 })),
      compliments: { ...SAMPLE.compliments, goalPct: 0 },
      inventory: { ...SAMPLE.inventory, goalPct: 0 },
    });
    const incomplete = validateTargetsFormState(empty);
    expect(incomplete.ok).toBe(false);
    expect(incomplete.message).toContain('Заполните все поля');

    const complete = validateTargetsFormState(buildTargetsFormState(SAMPLE));
    expect(complete.ok).toBe(true);
    expect(complete.message).toBeNull();
  });

  it('requires every weekday weight in week profile', () => {
    const form = buildTargetsFormState(SAMPLE);
    form.weekProfile = [1, 1, 0, 1, 1, 1, 1];
    const result = validateTargetsFormState(form);
    expect(result.ok).toBe(false);
    expect(result.missing.some((item) => item.includes('профиль недели'))).toBe(true);
  });

  it('detects configured month by positive revenue plan', () => {
    expect(isTargetsMonthConfigured(SAMPLE)).toBe(true);
    expect(
      isTargetsMonthConfigured({
        ...SAMPLE,
        revenue: { ...SAMPLE.revenue, monthPlan: 0 },
      }),
    ).toBe(false);
  });
});

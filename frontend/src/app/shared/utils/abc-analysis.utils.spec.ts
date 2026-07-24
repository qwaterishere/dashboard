import { computeAbcClasses, computeAbcWithMeta } from './abc-analysis.utils';

describe('abc-analysis.utils', () => {
  it('assigns A to items within first 80% cumulative share', () => {
    const items = [{ v: 80 }, { v: 15 }, { v: 5 }];
    const result = computeAbcClasses(items, 'v');
    expect(result.map((x) => x.abc)).toEqual(['A', 'B', 'C']);
  });

  it('assigns B to items between 80% and 95%', () => {
    const items = [{ v: 50 }, { v: 30 }, { v: 15 }, { v: 5 }];
    const result = computeAbcClasses(items, 'v');
    expect(result.map((x) => x.abc)).toEqual(['A', 'A', 'B', 'C']);
  });

  it('returns all C when total is zero', () => {
    const result = computeAbcClasses([{ v: 0 }, { v: 0 }], 'v');
    expect(result.every((x) => x.abc === 'C')).toBe(true);
  });

  it('computeAbcWithMeta adds rank, share and cumShare without changing boundaries', () => {
    const items = [
      { name: 'a', v: 50 },
      { name: 'b', v: 30 },
      { name: 'c', v: 15 },
      { name: 'd', v: 5 },
    ];
    const result = computeAbcWithMeta(items, 'v');

    expect(result.map((x) => x.abc)).toEqual(['A', 'A', 'B', 'C']);
    expect(result.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    expect(result[0].share).toBeCloseTo(50, 5);
    expect(result[0].cumShare).toBeCloseTo(50, 5);
    expect(result[1].cumShare).toBeCloseTo(80, 5);
    expect(result[2].cumShare).toBeCloseTo(95, 5);
    expect(result[3].cumShare).toBeCloseTo(100, 5);
    expect(result[3].share).toBeCloseTo(5, 5);
  });

  it('computeAbcClasses strips meta fields', () => {
    const result = computeAbcClasses([{ v: 80 }, { v: 20 }], 'v');
    expect(result[0]).toEqual({ v: 80, abc: 'A' });
    expect('rank' in result[0]).toBe(false);
    expect('share' in result[0]).toBe(false);
    expect('cumShare' in result[0]).toBe(false);
  });

  it('zero total meta uses rank and full cumShare', () => {
    const result = computeAbcWithMeta([{ v: 0 }, { v: 0 }], 'v');
    expect(result.map((x) => x.rank)).toEqual([1, 2]);
    expect(result.every((x) => x.share === 0 && x.cumShare === 100 && x.abc === 'C')).toBe(true);
  });
});

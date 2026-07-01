import { computeAbcClasses } from './abc-analysis.utils';

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
});

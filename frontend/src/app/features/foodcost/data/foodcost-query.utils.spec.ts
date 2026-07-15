import { resolveFoodcostQuery } from './foodcost-query.utils';

describe('foodcost-query.utils', () => {
  const anchor = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };

  it('returns latest when anchor is missing', () => {
    expect(resolveFoodcostQuery('month', null, null)).toEqual({});
  });

  it('maps month granularity to year+month', () => {
    expect(resolveFoodcostQuery('month', null, anchor)).toEqual({ year: 2026, month: 6 });
  });

  it('maps year granularity to year only', () => {
    expect(resolveFoodcostQuery('year', null, anchor)).toEqual({ year: 2026 });
  });

  it('maps week granularity to month slice of selected week', () => {
    expect(
      resolveFoodcostQuery('week', { year: 2026, month: 6, weekStartDate: '2026-06-02', weekEndDate: '2026-06-08' }, anchor),
    ).toEqual({ year: 2026, month: 6 });
  });
});

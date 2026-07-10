import { readSalesDayQuery } from './sales-route-query.utils';

describe('readSalesDayQuery', () => {
  it('parses date_from and date_to from url', () => {
    expect(readSalesDayQuery('/sales?date_from=2026-06-01&date_to=2026-06-07')).toEqual({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    });
  });

  it('returns null when query is incomplete', () => {
    expect(readSalesDayQuery('/sales?date_from=2026-06-01')).toBeNull();
    expect(readSalesDayQuery('/sales')).toBeNull();
  });
});

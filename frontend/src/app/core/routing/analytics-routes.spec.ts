import { describe, expect, it } from 'vitest';

import { pagesToSyncForRoute } from './analytics-routes';

describe('pagesToSyncForRoute', () => {
  it('keeps warehouse with dashboard for stock mini, plus attention', () => {
    expect(pagesToSyncForRoute('dashboard')).toEqual([
      'dashboard',
      'warehouse',
      'attention',
    ]);
  });

  it('does not force dashboard+warehouse for other analytics pages', () => {
    expect(pagesToSyncForRoute('sales')).toEqual(['sales', 'attention']);
    expect(pagesToSyncForRoute('foodcost')).toEqual(['foodcost', 'attention']);
    expect(pagesToSyncForRoute('warehouse')).toEqual(['warehouse', 'attention']);
  });
});

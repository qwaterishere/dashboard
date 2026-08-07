import { describe, expect, it } from 'vitest';

import { readWarehouseFocusQuery } from './warehouse-route-query.utils';

describe('readWarehouseFocusQuery', () => {
  it('reads focus=negative', () => {
    expect(readWarehouseFocusQuery('/warehouse?focus=negative')).toBe('negative');
  });

  it('returns null for other or missing focus', () => {
    expect(readWarehouseFocusQuery('/warehouse')).toBeNull();
    expect(readWarehouseFocusQuery('/warehouse?focus=other')).toBeNull();
  });
});

import {
  computeSalesPresetRange,
  formatSalesPeriodLabel,
  normalizeSalesDateRange,
  salesPresetNote,
} from './sales-period-range.utils';

describe('sales-period-range.utils', () => {
  describe('computeSalesPresetRange', () => {
    it('day uses anchor for both ends', () => {
      expect(computeSalesPresetRange('day', '2026-06-10')).toEqual({
        dateFrom: '2026-06-10',
        dateTo: '2026-06-10',
      });
    });

    it('week is ISO Mon–Sun containing anchor', () => {
      // 2026-06-10 = Wednesday → Mon 08 … Sun 14
      expect(computeSalesPresetRange('week', '2026-06-10')).toEqual({
        dateFrom: '2026-06-08',
        dateTo: '2026-06-14',
      });
    });

    it('month is 1st through anchor day', () => {
      expect(computeSalesPresetRange('month', '2026-06-10')).toEqual({
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
      });
    });
  });

  describe('formatSalesPeriodLabel', () => {
    it('formats a single day', () => {
      expect(formatSalesPeriodLabel('2026-06-01', '2026-06-01')).toBe('1 июн 2026');
    });

    it('formats a range inside one month', () => {
      expect(formatSalesPeriodLabel('2026-06-01', '2026-06-16')).toBe('1–16 июн 2026');
    });

    it('formats a cross-month range in the same year', () => {
      expect(formatSalesPeriodLabel('2026-05-28', '2026-06-03')).toBe(
        '28 май — 3 июн 2026',
      );
    });

    it('formats a cross-year range', () => {
      expect(formatSalesPeriodLabel('2025-12-30', '2026-01-02')).toBe(
        '30 дек 2025 — 2 янв 2026',
      );
    });
  });

  it('normalizeSalesDateRange swaps inverted bounds', () => {
    expect(normalizeSalesDateRange('2026-06-10', '2026-06-01')).toEqual({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-10',
    });
  });

  it('salesPresetNote covers presets', () => {
    expect(salesPresetNote('custom')).toContain('произвольн');
    expect(salesPresetNote('week')).toContain('неделя');
  });
});

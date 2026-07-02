import { buildStockChartLayout } from './stock-dynamics.utils';

describe('stock-dynamics.utils', () => {
  it('builds chart layout with grid, area and dots', () => {
    const layout = buildStockChartLayout(
      ['W1', 'W2', 'W3'],
      [100000, 120000, 110000],
      'all',
    );
    expect(layout.width).toBe(900);
    expect(layout.gridLines).toHaveLength(5);
    expect(layout.dots).toHaveLength(3);
    expect(layout.color).toBe('#6E6BFF');
  });

  it('uses category color for store filter', () => {
    const layout = buildStockChartLayout(['W1', 'W2'], [100000, 120000], 'k');
    expect(layout.color).toBe('#3DDC97');
  });
});

import { buildDonutChartLayout } from './donut-chart.utils';

describe('donut-chart.utils', () => {
  it('builds one arc per slice', () => {
    const layout = buildDonutChartLayout([
      { key: 'k', color: '#3ddc97', value: 60 },
      { key: 'b', color: '#6e6bff', value: 40 },
    ]);

    expect(layout.slices).toHaveLength(2);
    expect(layout.slices[0].path).toMatch(/^M[\d.]+ [\d.]+ A82 82/);
  });

  it('returns empty layout for zero total', () => {
    const layout = buildDonutChartLayout([
      { key: 'k', color: '#3ddc97', value: 0 },
    ]);
    expect(layout.slices).toHaveLength(0);
    expect(layout.innerShadeId).toBe('donut-inner-shade');
  });

  it('prefixes gradient ids when requested', () => {
    const layout = buildDonutChartLayout(
      [{ key: 'k', color: '#3ddc97', value: 1 }],
      { idPrefix: 'stock-mini' },
    );
    expect(layout.slices[0].gradientId).toBe('stock-mini-g-0');
    expect(layout.innerShadeId).toBe('stock-mini-inner-shade');
  });
});

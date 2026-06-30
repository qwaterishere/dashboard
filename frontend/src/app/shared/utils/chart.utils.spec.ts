import { describeArc, shade } from './chart.utils';

describe('chart.utils', () => {
  describe('describeArc', () => {
    it('returns SVG arc path', () => {
      const path = describeArc(100, 100, 50, 0, 90);
      expect(path).toMatch(/^M[\d.]+ [\d.]+ A50 50 0 0 1/);
    });

    it('uses large arc flag for sweeps > 180°', () => {
      const path = describeArc(0, 0, 10, 0, 270);
      expect(path).toContain(' A10 10 0 1 1 ');
    });
  });

  describe('shade', () => {
    it('darkens color with negative amount', () => {
      expect(shade('#FFFFFF', -50)).toBe('#cdcdcd');
    });

    it('lightens color with positive amount', () => {
      expect(shade('#000000', 50)).toBe('#323232');
    });
  });
});

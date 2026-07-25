import {
  foodcostGaugePosition,
  foodcostGaugeScale,
  foodcostGaugeTone,
} from './foodcost-gauge.utils';

describe('foodcost-gauge.utils', () => {
  it('maps value onto gauge track', () => {
    expect(foodcostGaugePosition(25, 20, 40)).toBe(25);
    expect(foodcostGaugePosition(20, 20, 40)).toBe(0);
    expect(foodcostGaugePosition(40, 20, 40)).toBe(100);
  });

  it('clamps out-of-range values', () => {
    expect(foodcostGaugePosition(10, 20, 40)).toBe(0);
    expect(foodcostGaugePosition(50, 20, 40)).toBe(100);
  });

  it('builds padded scale around fact and goal', () => {
    expect(foodcostGaugeScale(28.4, 27)).toEqual({ min: 20, max: 35 });
  });

  it('resolves inverted semaphore tone', () => {
    expect(foodcostGaugeTone(1.4)).toBe('bad');
    expect(foodcostGaugeTone(-1.2)).toBe('good');
    expect(foodcostGaugeTone(0.1)).toBe('mid');
  });
});

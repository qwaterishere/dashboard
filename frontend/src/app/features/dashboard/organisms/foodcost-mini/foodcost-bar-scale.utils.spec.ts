import { FOODCOST_BAR_SCALE_MAX, foodcostBarWidth } from './foodcost-bar-scale.utils';

describe('foodcost-bar-scale.utils', () => {
  it('maps foodcost percent 1:1 onto the track', () => {
    expect(FOODCOST_BAR_SCALE_MAX).toBe(100);
    expect(foodcostBarWidth(28)).toBe(28);
    expect(foodcostBarWidth(65)).toBe(65);
    expect(foodcostBarWidth(100)).toBe(100);
  });

  it('clamps width to the track', () => {
    expect(foodcostBarWidth(120)).toBe(100);
    expect(foodcostBarWidth(-5)).toBe(0);
  });
});

import { ActivatedRouteSnapshot } from '@angular/router';

import { AnalyticsRouteReuseStrategy } from './analytics-route-reuse.strategy';

function routeWithPath(path: string | undefined): ActivatedRouteSnapshot {
  return { routeConfig: path ? { path } : undefined } as ActivatedRouteSnapshot;
}

describe('AnalyticsRouteReuseStrategy', () => {
  const strategy = new AnalyticsRouteReuseStrategy();

  it('caches analytics routes', () => {
    expect(strategy.shouldDetach(routeWithPath('dashboard'))).toBe(true);
    expect(strategy.shouldDetach(routeWithPath('sales'))).toBe(true);
    expect(strategy.shouldDetach(routeWithPath('warehouse'))).toBe(true);
    expect(strategy.shouldDetach(routeWithPath('foodcost'))).toBe(true);
  });

  it('does not cache settings or placeholders', () => {
    expect(strategy.shouldDetach(routeWithPath('settings'))).toBe(false);
    expect(strategy.shouldDetach(routeWithPath('support'))).toBe(false);
    expect(strategy.shouldDetach(routeWithPath('purchases'))).toBe(false);
  });

  it('reuses route when config is unchanged', () => {
    const config = { path: 'sales' };
    const current = { routeConfig: config } as ActivatedRouteSnapshot;
    const future = { routeConfig: config } as ActivatedRouteSnapshot;
    expect(strategy.shouldReuseRoute(future, current)).toBe(true);
  });
});

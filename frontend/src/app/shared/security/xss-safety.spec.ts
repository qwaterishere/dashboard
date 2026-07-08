import { ComponentFixture, TestBed } from '@angular/core/testing';

import { XSS_TEST_PAYLOADS, hasDangerousDom } from './xss-test.utils';
import { KpiCardOrganismComponent } from '../../features/dashboard/organisms/kpi-card/kpi-card-organism.component';
import { PositionsTableOrganismComponent } from '../../features/sales/organisms/positions-table/positions-table-organism.component';
import type { SalesPositionComputed } from '../../features/sales/data/sales-aggregation.utils';

describe('XSS safety', () => {
  describe('KpiCardOrganismComponent', () => {
    let fixture: ComponentFixture<KpiCardOrganismComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [KpiCardOrganismComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(KpiCardOrganismComponent);
    });

    it.each(XSS_TEST_PAYLOADS)('escapes malicious title: %s', (payload) => {
      fixture.componentRef.setInput('title', payload);
      fixture.componentRef.setInput('value', 1000);
      fixture.componentRef.setInput('forecastHeadline', '—');
      fixture.componentRef.setInput('trackPct', 50);
      fixture.detectChanges();

      expect(hasDangerousDom(fixture.nativeElement)).toBe(false);
    });
  });

  describe('PositionsTableOrganismComponent', () => {
    let fixture: ComponentFixture<PositionsTableOrganismComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [PositionsTableOrganismComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(PositionsTableOrganismComponent);
    });

    it.each(XSS_TEST_PAYLOADS)('escapes malicious product name: %s', (payload) => {
      const row: SalesPositionComputed & { abc: 'A' } = {
        name: payload,
        sub: payload,
        cat: 'k',
        qty: 1,
        rev: 100,
        cost: 50,
        gp: 50,
        fc: 30,
        abc: 'A',
      };
      fixture.componentRef.setInput('rows', [row]);
      fixture.detectChanges();

      expect(hasDangerousDom(fixture.nativeElement)).toBe(false);
    });
  });
});

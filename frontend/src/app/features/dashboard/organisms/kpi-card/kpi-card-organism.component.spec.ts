import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KpiCardOrganismComponent } from './kpi-card-organism.component';

describe('KpiCardOrganismComponent', () => {
  let fixture: ComponentFixture<KpiCardOrganismComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardOrganismComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(KpiCardOrganismComponent);
    fixture.componentRef.setInput('title', 'Выручка');
    fixture.componentRef.setInput('value', 8144000);
    fixture.componentRef.setInput('lflPct', 8.4);
    fixture.componentRef.setInput('lflDir', 'up');
    fixture.componentRef.setInput('forecastHeadline', '22,1 млн · 103 %');
    fixture.componentRef.setInput('trackPct', 93.6);
    fixture.detectChanges();
  });

  it('renders KPI title, value and LfL badge', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Выручка');
    expect(text).toContain('8');
    expect(text).toContain('144');
    expect(text).toContain('000');
    expect(text).toContain('LfL');
    expect(text).toContain('+8,4 %');
  });

  it('uses revenue modifier class', () => {
    expect(fixture.nativeElement.querySelector('.kpi.m-rev')).toBeTruthy();
  });
});

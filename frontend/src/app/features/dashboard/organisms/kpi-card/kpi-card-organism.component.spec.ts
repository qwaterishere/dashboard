import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KpiCardOrganismComponent } from './kpi-card-organism.component';

describe('KpiCardOrganismComponent', () => {
  let fixture: ComponentFixture<KpiCardOrganismComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardOrganismComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(KpiCardOrganismComponent);
    fixture.componentRef.setInput('heading', 'Выручка');
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

  it('keeps LfL slot height when comparison is unavailable', () => {
    fixture.componentRef.setInput('lflPct', undefined);
    fixture.componentRef.setInput('lflDir', undefined);
    fixture.detectChanges();

    const slot = fixture.nativeElement.querySelector('.k-val__lfl') as HTMLElement;
    expect(slot).toBeTruthy();
    expect(slot.querySelector('app-lfl-badge')).toBeFalsy();
  });

  it('hides forecast on week timeframe while keeping footer slot', () => {
    fixture.componentRef.setInput('showForecast', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-goal-track')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.kpi__forecast-placeholder')).toBeTruthy();
  });

  it('uses fixed-height footer slot for week footer', () => {
    fixture.componentRef.setInput('showForecast', false);
    fixture.componentRef.setInput('weekFooter', {
      label: 'Средний день',
      headline: '100 000 ₽',
    });
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('.kpi__forecast') as HTMLElement;
    expect(footer).toBeTruthy();
    expect(footer.style.height).not.toBe('auto');
    expect(getComputedStyle(footer).flex).toContain('0 0');
  });
});

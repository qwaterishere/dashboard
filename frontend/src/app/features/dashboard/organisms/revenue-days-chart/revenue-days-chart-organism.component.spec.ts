import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideMockAuthenticatedAuth } from '../../../../core/auth/auth.testing';
import { AuthService } from '../../../../core/auth/auth.service';
import { RevenueDaysChartOrganismComponent } from './revenue-days-chart-organism.component';

const sampleDays = [
  { day: 1, weekday: 1, revenue: 637000, plan: 640000, forecast: null, checks: 306, guests: 704, avg: 2082 },
  { day: 2, weekday: 2, revenue: 623000, plan: 640000, forecast: null, checks: 293, guests: 674, avg: 2126 },
];

describe('RevenueDaysChartOrganismComponent', () => {
  let fixture: ComponentFixture<RevenueDaysChartOrganismComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RevenueDaysChartOrganismComponent],
      providers: [provideMockAuthenticatedAuth()],
    }).compileComponents();

    fixture = TestBed.createComponent(RevenueDaysChartOrganismComponent);
    fixture.componentRef.setInput('days', sampleDays);
    fixture.componentRef.setInput('max', 1200000);
    fixture.componentRef.setInput('period', { year: 2026, month: 6, dayFrom: 1, dayTo: 11 });
    fixture.componentRef.setInput('timeframe', 'month');
    fixture.componentRef.setInput('displayMode', 'day');
    fixture.detectChanges();
  });

  it('renders chart bars from layout computed input', () => {
    const bars = fixture.nativeElement.querySelectorAll('.dbar');
    expect(bars.length).toBe(2);
  });

  it('shows day-mode chart title', () => {
    expect(fixture.nativeElement.textContent).toContain('Выручка по дням');
  });

  it('emits displayModeChange when segment value changes', () => {
    const changes: string[] = [];
    fixture.componentInstance.displayModeChange.subscribe((mode) => changes.push(mode));

    const weekButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: Element) => button.textContent?.trim() === 'Недели',
    ) as HTMLButtonElement;
    weekButton.click();
    fixture.detectChanges();

    expect(changes).toEqual(['week']);
  });

  it('does not inject PeriodService', () => {
    expect(Object.prototype.hasOwnProperty.call(fixture.componentInstance, 'periodService')).toBe(false);
  });
});

describe('RevenueDaysChartOrganismComponent auth isolation', () => {
  it('uses PopoverController without PeriodService coupling', () => {
    TestBed.configureTestingModule({
      imports: [RevenueDaysChartOrganismComponent],
      providers: [provideMockAuthenticatedAuth()],
    });
    expect(() => TestBed.inject(AuthService)).not.toThrow();
  });
});

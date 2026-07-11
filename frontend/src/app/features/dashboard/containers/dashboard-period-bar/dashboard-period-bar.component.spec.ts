import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PeriodService } from '../../../../core/services/period.service';
import type { DashboardChartPickerConfig } from '../../data/dashboard-data.store';
import { DashboardDataStore } from '../../data/dashboard-data.store';
import { DashboardPeriodBarComponent } from './dashboard-period-bar.component';

describe('DashboardPeriodBarComponent', () => {
  let fixture: ComponentFixture<DashboardPeriodBarComponent>;
  let periodService: PeriodService;

  const pickerConfig = signal<DashboardChartPickerConfig | null>({
    label: 'Август 2026',
    note: 'закрытые дни',
    granularity: 'month',
    bounds: { earliest: '2025-03-10', latest: '2026-08-22' },
    activePeriod: { year: 2026, month: 8, dayFrom: 1, dayTo: 22 },
    selection: null,
    showReset: false,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPeriodBarComponent],
      providers: [
        PeriodService,
        {
          provide: DashboardDataStore,
          useValue: {
            chartPeriodBarInfo: computed(() => ({
              label: pickerConfig()?.label ?? '…',
              note: pickerConfig()?.note ?? '',
            })),
            chartPickerConfig: computed(() => pickerConfig()),
          },
        },
      ],
    }).compileComponents();

    periodService = TestBed.inject(PeriodService);
    periodService.reset();
    periodService.markGranularitySynced();
    periodService.dashboardPeriod.set({ year: 2026, month: 6, dayFrom: 1, dayTo: 11 });
    periodService.chartDataBounds.set({ earliest: '2025-03-10', latest: '2026-08-22' });

    fixture = TestBed.createComponent(DashboardPeriodBarComponent);
    fixture.detectChanges();
  });

  it('renders period bar with chart picker label', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Август 2026');
    expect(el.textContent).toContain('Неделя');
    expect(el.textContent).toContain('Месяц');
    expect(el.textContent).toContain('Год');
  });

  it('forwards applied selection to PeriodService', () => {
    fixture.componentInstance.onApplied({ year: 2026, month: 5 });
    expect(periodService.chartPeriod()).toEqual({ year: 2026, month: 5 });
  });

  it('resets chart period to implicit latest', () => {
    periodService.applyChartPeriod({ year: 2026, month: 5 });
    expect(periodService.chartPeriod()).toEqual({ year: 2026, month: 5 });

    fixture.componentInstance.onReset();
    expect(periodService.chartPeriod()).toBeNull();
  });
});

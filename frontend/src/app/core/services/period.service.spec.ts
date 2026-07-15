import { TestBed } from '@angular/core/testing';

import { PeriodService } from './period.service';
import {
  chartPeriodSelectionForMonthDay,
  resolveWeekByIndexInMonth,
} from '../../shared/utils/chart-period.utils';

describe('PeriodService', () => {
  const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };
  const dashboardPeriod = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(PeriodService);
    service.reset();
    service.markGranularitySynced();
  });

  it('defaults granularity to month', () => {
    const service = TestBed.inject(PeriodService);
    expect(service.granularity()).toBe('month');
  });

  it('reset clears chart and dashboard period state', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 5 });
    service.granularity.set('week');
    service.chartDisplayMode.set('quarter');

    service.reset();

    expect(service.granularity()).toBe('month');
    expect(service.chartDisplayMode()).toBe('day');
    expect(service.dashboardPeriod()).toBeNull();
    expect(service.chartDataBounds()).toBeNull();
    expect(service.chartPeriod()).toBeNull();
  });

  it('returns null salesQuery without dashboard period', () => {
    const service = TestBed.inject(PeriodService);
    expect(service.salesQuery()).toBeNull();
  });

  it('builds salesQuery from dashboard period without chartPeriod', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('year');
    TestBed.flushEffects();
    service.granularity.set('week');
    TestBed.flushEffects();
    service.applyChartPeriod(chartPeriodSelectionForMonthDay(2025, 3, 10, bounds));
    expect(service.salesQuery()).toEqual({
      dateFrom: '2026-06-08',
      dateTo: '2026-06-14',
    });
  });

  it('normalizes to implicit latest when switching to month in current year', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('year');
    TestBed.flushEffects();
    service.applyChartPeriod({ year: 2026, month: 1 });
    service.granularity.set('month');
    TestBed.flushEffects();

    expect(service.chartPeriod()).toBeNull();
  });

  it('sets first month when switching to month in past year', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('year');
    TestBed.flushEffects();
    service.applyChartPeriod({ year: 2025, month: 1 });
    service.granularity.set('month');
    TestBed.flushEffects();

    expect(service.chartPeriod()).toEqual({ year: 2025, month: 3 });
  });

  it('normalizes to implicit latest when switching to week in current year', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('year');
    TestBed.flushEffects();
    service.applyChartPeriod({ year: 2026, month: 1 });
    service.granularity.set('week');
    TestBed.flushEffects();

    expect(service.chartPeriod()).toBeNull();
  });

  it('sets first week when switching to week in past year', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('year');
    TestBed.flushEffects();
    service.applyChartPeriod({ year: 2025, month: 1 });
    service.granularity.set('week');
    TestBed.flushEffects();

    expect(service.chartPeriod()).toEqual({
      year: 2025,
      month: 3,
      weekStartDate: '2025-03-10',
      weekEndDate: '2025-03-16',
    });
  });

  it('keeps selected month when switching from month to week', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 5 });
    service.granularity.set('week');
    TestBed.flushEffects();

    expect(service.chartPeriod()?.year).toBe(2026);
    expect(service.chartPeriod()?.month).toBe(5);
    expect(service.chartPeriod()?.weekStartDate).toBe('2026-04-27');
    expect(service.chartPeriod()?.weekEndDate).toBe('2026-05-03');
  });

  it('restores selected month after month → year → month', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 3 });
    service.granularity.set('year');
    TestBed.flushEffects();
    service.granularity.set('month');
    TestBed.flushEffects();

    expect(service.chartPeriod()).toEqual({ year: 2026, month: 3 });
  });

  it('applies memorized month within newly selected year', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 3 });
    service.granularity.set('year');
    TestBed.flushEffects();
    service.applyChartPeriod({ year: 2025, month: 1 });
    service.granularity.set('month');
    TestBed.flushEffects();

    expect(service.chartPeriod()).toEqual({ year: 2025, month: 3 });
  });

  it('restores week index after week → month → week using month context', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('week');
    TestBed.flushEffects();
    service.applyChartPeriod(chartPeriodSelectionForMonthDay(2026, 5, 4, bounds));
    service.granularity.set('month');
    TestBed.flushEffects();
    service.granularity.set('week');
    TestBed.flushEffects();

    const expected = resolveWeekByIndexInMonth(2026, 8, bounds, 2);
    expect(service.chartPeriod()).toEqual({
      year: 2026,
      month: expected.month,
      weekStartDate: expected.startDate,
      weekEndDate: expected.endDate,
    });
  });

  it('applies memorized week index within month context of selected year', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 5 });
    service.granularity.set('week');
    TestBed.flushEffects();
    service.applyChartPeriod(chartPeriodSelectionForMonthDay(2026, 5, 4, bounds));
    service.granularity.set('year');
    TestBed.flushEffects();
    service.applyChartPeriod({ year: 2025, month: 1 });
    service.granularity.set('week');
    TestBed.flushEffects();

    const expected = resolveWeekByIndexInMonth(2025, 5, bounds, 2);
    expect(service.chartPeriod()).toEqual({
      year: 2025,
      month: expected.month,
      weekStartDate: expected.startDate,
      weekEndDate: expected.endDate,
    });
  });

  it('clamps week index to nearest when month has fewer weeks', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('week');
    TestBed.flushEffects();
    service.applyChartPeriod(
      chartPeriodSelectionForMonthDay(2026, 6, 29, bounds),
    );
    service.granularity.set('month');
    TestBed.flushEffects();
    service.applyChartPeriod({ year: 2026, month: 2 });
    service.granularity.set('week');
    TestBed.flushEffects();

    expect(service.chartPeriod()?.month).toBe(2);
    expect(service.chartPeriod()?.weekStartDate).toBe('2026-02-23');
    expect(service.chartPeriod()?.weekEndDate).toBe('2026-03-01');
  });

  it('defaults chart display mode on timeframe change', () => {
    const service = TestBed.inject(PeriodService);
    service.chartDisplayMode.set('quarter');
    service.granularity.set('week');
    TestBed.flushEffects();
    expect(service.chartDisplayMode()).toBe('day');

    service.chartDisplayMode.set('day');
    service.granularity.set('year');
    TestBed.flushEffects();
    expect(service.chartDisplayMode()).toBe('month');
  });

  it('clamps invalid chart display mode for timeframe', () => {
    const service = TestBed.inject(PeriodService);
    service.granularity.set('week');
    service.chartDisplayMode.set('quarter');
    TestBed.flushEffects();
    expect(service.chartDisplayMode()).toBe('day');

    service.granularity.set('month');
    service.chartDisplayMode.set('quarter');
    TestBed.flushEffects();
    expect(service.chartDisplayMode()).toBe('day');
  });

  it('resetChartPeriodToLatest clears to implicit latest for month granularity', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 5 });
    service.resetChartPeriodToLatest();
    expect(service.chartPeriod()).toBeNull();
  });

  it('resetChartPeriodToLatest clears to implicit latest for week granularity', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod(chartPeriodSelectionForMonthDay(2026, 5, 4, bounds));
    service.granularity.set('week');
    service.resetChartPeriodToLatest();
    expect(service.chartPeriod()).toBeNull();
  });

  it('applyChartPeriod normalizes explicit latest selection to null', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 8 });
    expect(service.chartPeriod()).toBeNull();
  });

  it('clears custom compare when chart period collides with it', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyChartPeriod({ year: 2026, month: 6 });
    service.applyComparePeriod({ year: 2026, month: 5 });

    expect(service.comparePeriod()).toEqual({ year: 2026, month: 5 });

    service.applyChartPeriod({ year: 2026, month: 5 });
    expect(service.comparePeriod()).toBeNull();
  });

  it('normalizes month-shaped custom compare when switching to week granularity', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.applyComparePeriod({ year: 2026, month: 5 });

    service.granularity.set('week');
    TestBed.flushEffects();

    expect(service.granularity()).toBe('week');
    expect(service.comparePeriod()?.weekStartDate).toBe('2026-05-01');
    expect(service.comparePeriod()?.weekEndDate).toBe('2026-05-11');
  });

  it('clears custom compare week when chart week collides with it', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set(dashboardPeriod);
    service.chartDataBounds.set(bounds);
    service.granularity.set('week');
    service.markGranularitySynced();
    service.applyChartPeriod({
      year: 2026,
      month: 6,
      weekStartDate: '2026-06-08',
      weekEndDate: '2026-06-14',
    });
    service.applyComparePeriod({
      year: 2026,
      month: 5,
      weekStartDate: '2026-06-01',
      weekEndDate: '2026-06-07',
    });

    expect(service.comparePeriod()?.weekStartDate).toBe('2026-06-01');

    service.applyChartPeriod({
      year: 2026,
      month: 6,
      weekStartDate: '2026-06-01',
      weekEndDate: '2026-06-07',
    });
    expect(service.comparePeriod()).toBeNull();
  });
});

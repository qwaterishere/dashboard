import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { BaseMetricsRepository } from './base-metrics.repository';
import { DashboardRepository } from './dashboard.repository';
import { TargetsRepository } from './targets.repository';
import type { MetricSnapshotApi } from '../../shared/models/base-metrics-api.model';

function sampleSnapshot(): MetricSnapshotApi {
  return {
    mode: 'full',
    bounds: { date_from: '2026-01-01', date_to: '2026-06-11' },
    date_from: '2026-06-01',
    date_to: '2026-06-11',
    compare_date_from: '2026-05-01',
    compare_date_to: '2026-05-11',
    batch: {
      items: [
        {
          metric: 'revenue',
          unit: 'money',
          date_from: '2026-06-01',
          date_to: '2026-06-11',
          value: 1000,
          base_date_from: '2026-05-01',
          base_date_to: '2026-05-11',
          base_value: 800,
          base_incomplete: false,
        },
        {
          metric: 'checks',
          unit: 'count',
          date_from: '2026-06-01',
          date_to: '2026-06-11',
          value: 10,
          base_value: 8,
          base_incomplete: false,
        },
        {
          metric: 'guests',
          unit: 'count',
          date_from: '2026-06-01',
          date_to: '2026-06-11',
          value: 20,
          base_value: 16,
          base_incomplete: false,
        },
        {
          metric: 'avg-check',
          unit: 'ratio',
          date_from: '2026-06-01',
          date_to: '2026-06-11',
          value: 100,
          base_value: 100,
          base_incomplete: false,
        },
      ],
    },
    units: {
      date_from: '2026-06-01',
      date_to: '2026-06-11',
      base_date_from: '2026-05-01',
      base_date_to: '2026-05-11',
      units: [
        { key: 'k', revenue: 1000, cost: 300, prev_revenue: 800, prev_cost: 200 },
        { key: 'b', revenue: 0, cost: 0, prev_revenue: 0, prev_cost: 0 },
        { key: 'w', revenue: 0, cost: 0, prev_revenue: 0, prev_cost: 0 },
        { key: 'o', revenue: 0, cost: 0, prev_revenue: 0, prev_cost: 0 },
      ],
    },
    day_series: [
      {
        metric: 'revenue',
        unit: 'money',
        date_from: '2026-06-01',
        date_to: '2026-06-02',
        granularity: 'day',
        points: [
          { date: '2026-06-01', value: 500 },
          { date: '2026-06-02', value: 500 },
        ],
      },
      {
        metric: 'checks',
        unit: 'count',
        date_from: '2026-06-01',
        date_to: '2026-06-02',
        granularity: 'day',
        points: [
          { date: '2026-06-01', value: 5 },
          { date: '2026-06-02', value: 5 },
        ],
      },
      {
        metric: 'guests',
        unit: 'count',
        date_from: '2026-06-01',
        date_to: '2026-06-02',
        granularity: 'day',
        points: [
          { date: '2026-06-01', value: 10 },
          { date: '2026-06-02', value: 10 },
        ],
      },
    ],
    month_series: [],
    forecasts: [
      {
        metric: 'revenue',
        date_from: '2026-06-01',
        date_to: '2026-06-11',
        horizon_end: '2026-06-30',
        ready: true,
        forecast: 3000,
        forecast_today: 1100,
        pace_risk: false,
        pace_risk_ratio: 0.98,
        points: [],
      },
      {
        metric: 'checks',
        date_from: '2026-06-01',
        date_to: '2026-06-11',
        horizon_end: '2026-06-30',
        ready: true,
        forecast: 30,
        forecast_today: 11,
        pace_risk: false,
        pace_risk_ratio: 0.98,
        points: [],
      },
      {
        metric: 'guests',
        date_from: '2026-06-01',
        date_to: '2026-06-11',
        horizon_end: '2026-06-30',
        ready: true,
        forecast: 60,
        forecast_today: 22,
        pace_risk: false,
        pace_risk_ratio: 0.98,
        points: [],
      },
    ],
    week_start: null,
    week_end: null,
    week_batch: null,
    week_units: null,
    week_day_series: [],
    month_revenue: null,
  };
}

describe('DashboardRepository (snapshot)', () => {
  it('assembles DashboardApi from one snapshot call', async () => {
    const metrics = {
      getSnapshot: vi.fn(() =>
        of(
          new HttpResponse({
            body: sampleSnapshot(),
            status: 200,
            headers: new HttpHeaders({ ETag: 'W/"snap"' }),
          }),
        ),
      ),
      getBounds: vi.fn(),
      getDefaultPeriod: vi.fn(),
    };

    const targets = {
      fetch: vi.fn(() =>
        of({
          period: { year: 2026, month: 6, label: 'июнь' },
          reference: { label: '', revenueFact: 0, revenuePace: 0 },
          revenue: { monthPlan: 0, weekProfile: [1, 1, 1, 1, 1, 1, 1] },
          dailyOverrides: {},
          foodcost: [],
          writeoffs: [],
          compliments: {
            mode: 'pct',
            goalPct: 0,
            goalRub: 0,
            factPct: 0,
            factRub: 0,
          },
          inventory: { mode: 'pct', goalPct: 0, goalRub: 0, note: '' },
          locked: false,
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        DashboardRepository,
        { provide: BaseMetricsRepository, useValue: metrics },
        { provide: TargetsRepository, useValue: targets },
      ],
    });

    const repo = TestBed.inject(DashboardRepository);
    const result = await firstValueFrom(repo.fetch({}));
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data.kpis.revenue.value).toBe(1000);
      expect(result.data.period.month).toBe(6);
      expect(result.etag).toBe('W/"snap"');
    }
    expect(metrics.getSnapshot).toHaveBeenCalledTimes(1);
    expect(metrics.getBounds).not.toHaveBeenCalled();

    await firstValueFrom(repo.fetch({ year: 2026, month: 6 }));
    expect(metrics.getSnapshot).toHaveBeenCalledTimes(2);
    expect(metrics.getSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'full', year: 2026, month: 6 }),
    );
    expect(metrics.getBounds).not.toHaveBeenCalled();
  });
});

import { computed, Injectable, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';

import type { PeriodGranularity, PeriodInfo } from '../../../shared/models/common.model';
import type { DashboardV2 } from '../../../shared/models/dashboard-v2.model';
import type { WarehouseData } from '../../../shared/models/warehouse.model';
import { buildPeriodInfo, formatChartPeriodLabel } from '../../../shared/utils/period-format.utils';
import {
  buildDashboardViewModel,
  buildStockFromWarehouse,
} from './dashboard-v2.utils';

const LOADING: PeriodInfo = { label: '…', note: 'загрузка' };
const ERROR: PeriodInfo = { label: '—', note: 'нет данных' };

export interface DateRangeQuery {
  dateFrom: string;
  dateTo: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardDataStore {
  readonly granularity = signal<PeriodGranularity>('month');

  readonly dashboard = httpResource<DashboardV2>(() => ({ url: '/api/dashboard' }));
  readonly warehouse = httpResource<WarehouseData>(() => ({ url: '/api/warehouse' }));

  readonly period = computed<PeriodInfo>(() => {
    const resource = this.dashboard;
    if (resource.hasValue()) {
      const { period, compare } = resource.value();
      const base = buildPeriodInfo(period, compare);
      return { ...base, note: this.periodNote(period) };
    }
    if (resource.error()) return ERROR;
    return LOADING;
  });

  readonly salesQuery = computed<DateRangeQuery | null>(() => {
    const resource = this.dashboard;
    if (!resource.hasValue()) return null;
    const period = resource.value().period;
    const range = this.resolveRange(period, this.granularity());
    return {
      dateFrom: this.toIsoDate(period.year, period.month, range.fromDay),
      dateTo: this.toIsoDate(period.year, period.month, range.toDay),
    };
  });

  readonly viewModel = computed(() => {
    if (!this.dashboard.hasValue()) return null;

    const data = this.dashboard.value();
    const granularity = this.granularity();
    const stock = this.warehouse.hasValue()
      ? buildStockFromWarehouse(this.warehouse.value())
      : null;

    return buildDashboardViewModel(data, {
      granularity,
      stock,
      chartPeriodLabel: formatChartPeriodLabel(data.period, granularity),
    });
  });

  private periodNote(_period: DashboardV2['period']): string {
    const g = this.granularity();
    if (g === 'week') return 'последние 7 закрытых дней';
    if (g === 'year') return 'закрытые дни месяца · годовой контекст';
    return 'закрытые дни';
  }

  private resolveRange(
    period: DashboardV2['period'],
    granularity: PeriodGranularity,
  ): { fromDay: number; toDay: number } {
    const toDay = period.dayTo;
    if (granularity === 'week') {
      return { fromDay: Math.max(period.dayFrom, toDay - 6), toDay };
    }
    return { fromDay: period.dayFrom, toDay };
  }

  private toIsoDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}

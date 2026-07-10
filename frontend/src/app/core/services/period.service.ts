import { computed, Injectable, signal } from '@angular/core';

import type { PeriodGranularity } from '../../shared/models/common.model';
import type { DashboardV2 } from '../../shared/models/dashboard-v2.model';

export interface DateRangeQuery {
  dateFrom: string;
  dateTo: string;
}

/** Количество дней в недельной гранулярности (включая конечный день). */
export const WEEK_GRANULARITY_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PeriodService {
  readonly granularity = signal<PeriodGranularity>('month');
  readonly dashboardPeriod = signal<DashboardV2['period'] | null>(null);

  readonly salesQuery = computed<DateRangeQuery | null>(() => {
    const period = this.dashboardPeriod();
    if (!period) return null;
    const range = this.resolveRange(period, this.granularity());
    return {
      dateFrom: this.toIsoDate(period.year, period.month, range.fromDay),
      dateTo: this.toIsoDate(period.year, period.month, range.toDay),
    };
  });

  periodNote(granularity: PeriodGranularity): string {
    if (granularity === 'week') return 'последние 7 закрытых дней';
    if (granularity === 'year') return 'закрытые дни месяца · годовой контекст';
    return 'закрытые дни';
  }

  resolveRange(
    period: DashboardV2['period'],
    granularity: PeriodGranularity,
  ): { fromDay: number; toDay: number } {
    const toDay = period.dayTo;
    if (granularity === 'week') {
      return { fromDay: Math.max(period.dayFrom, toDay - (WEEK_GRANULARITY_DAYS - 1)), toDay };
    }
    return { fromDay: period.dayFrom, toDay };
  }

  toIsoDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}

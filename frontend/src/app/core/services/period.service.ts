import { computed, effect, Injectable, signal, untracked } from '@angular/core';

import type { ChartDisplayMode, PeriodGranularity } from '../../shared/models/common.model';
import type {
  ChartPeriodSelection,
  ChartPeriodMonthMemory,
  ChartPeriodWeekMemory,
} from '../../shared/models/chart-period.model';
import type { DashboardV2, DataBoundsV2 } from '../../shared/models/dashboard-v2.model';
import {
  availableChartDisplayModes,
  defaultChartDisplayMode,
} from '../../shared/constants/chart-display.constants';
import {
  clampChartMonthInYear,
  isChartPeriodResetVisible,
  resolveDefaultChartMonth,
  resolveDefaultWeekForMonth,
  resolveDefaultWeekRange,
  resolveLatestChartPeriodSelection,
  resolveWeekByIndexInMonth,
  weekIndexInMonth,
} from '../../shared/utils/chart-period.utils';

export type { ChartPeriodSelection } from '../../shared/models/chart-period.model';

export interface DateRangeQuery {
  dateFrom: string;
  dateTo: string;
}

@Injectable({ providedIn: 'root' })
export class PeriodService {
  readonly granularity = signal<PeriodGranularity>('month');
  readonly chartDisplayMode = signal<ChartDisplayMode>('day');
  readonly dashboardPeriod = signal<DashboardV2['period'] | null>(null);
  readonly chartDataBounds = signal<DashboardV2['dataBounds'] | null>(null);
  /** Выбранный период dashboard; null — последние данные из API. */
  readonly chartPeriod = signal<ChartPeriodSelection | null>(null);

  private previousGranularity: PeriodGranularity | null = null;
  /** Семантическая память picker: месяц / номер недели / год. */
  private chartPeriodMemory: {
    month?: ChartPeriodMonthMemory;
    week?: ChartPeriodWeekMemory | null;
    year?: number | null;
  } = {};

  constructor() {
    effect(() => {
      const next = this.granularity();
      const prev = this.previousGranularity;
      const mode = this.chartDisplayMode();

      if (prev !== null && prev !== next) {
        untracked(() => {
          this.persistChartPeriodForGranularity(prev);
          this.restoreChartPeriodForGranularity(prev, next);
        });
      }

      const allowed = availableChartDisplayModes(next);
      const targetMode =
        prev !== null && prev !== next
          ? defaultChartDisplayMode(next)
          : allowed.includes(mode)
            ? mode
            : defaultChartDisplayMode(next);

      if (targetMode !== mode) {
        untracked(() => this.chartDisplayMode.set(targetMode));
      }

      this.previousGranularity = next;
    });
  }

  /** Полный сброс chart/dashboard period state (logout, tenant switch). */
  reset(): void {
    this.granularity.set('month');
    this.chartDisplayMode.set('day');
    this.dashboardPeriod.set(null);
    this.chartDataBounds.set(null);
    this.chartPeriod.set(null);
    this.chartPeriodMemory = {};
    this.previousGranularity = 'month';
  }

  /** @internal тесты: зафиксировать текущую granularity без срабатывания transition. */
  markGranularitySynced(): void {
    this.previousGranularity = this.granularity();
  }

  setChartDisplayMode(mode: ChartDisplayMode): void {
    const allowed = availableChartDisplayModes(this.granularity());
    if (allowed.includes(mode)) {
      this.chartDisplayMode.set(mode);
    }
  }

  applyChartPeriod(selection: ChartPeriodSelection): void {
    const granularity = this.granularity();
    if (granularity === 'year') {
      this.chartPeriod.set({ year: selection.year, month: 1 });
    } else if (
      granularity === 'week' &&
      selection.weekStartDate &&
      selection.weekEndDate
    ) {
      this.chartPeriod.set({
        year: selection.year,
        month: selection.month,
        weekStartDate: selection.weekStartDate,
        weekEndDate: selection.weekEndDate,
      });
    } else {
      this.chartPeriod.set({ year: selection.year, month: selection.month });
    }
    this.normalizeChartPeriodToImplicitLatest();
    this.persistChartPeriodForGranularity(granularity, true);
  }

  clearChartPeriod(): void {
    this.chartPeriod.set(null);
    this.persistChartPeriodForGranularity(this.granularity(), true);
  }

  /** Сбрасывает chartPeriod на последний доступный год / месяц / неделю. */
  resetChartPeriodToLatest(): void {
    const granularity = this.granularity();
    const latest = resolveLatestChartPeriodSelection(
      granularity,
      this.chartDataBounds(),
      this.dashboardPeriod(),
    );
    if (!latest) {
      this.clearChartPeriod();
      return;
    }

    if (granularity === 'year') {
      this.chartPeriod.set({ year: latest.year, month: 1 });
    } else if (granularity === 'week') {
      this.chartPeriod.set({
        year: latest.year,
        month: latest.month,
        weekStartDate: latest.weekStartDate!,
        weekEndDate: latest.weekEndDate!,
      });
    } else {
      this.chartPeriod.set({ year: latest.year, month: latest.month });
    }

    this.normalizeChartPeriodToImplicitLatest();
    this.persistChartPeriodForGranularity(granularity, true);
  }

  private normalizeChartPeriodToImplicitLatest(): void {
    if (
      !isChartPeriodResetVisible(
        this.chartPeriod(),
        this.granularity(),
        this.chartDataBounds(),
        this.dashboardPeriod(),
      )
    ) {
      this.chartPeriod.set(null);
    }
  }

  /** Date range для Sales — только KPI-period dashboard, без chartPeriod picker. */
  readonly salesQuery = computed<DateRangeQuery | null>(() => {
    const period = this.dashboardPeriod();
    if (!period) return null;

    const range =
      this.granularity() === 'week'
        ? resolveDefaultWeekRange(period.year, period.month, period.dayFrom, period.dayTo)
        : null;

    return {
      dateFrom: range?.startDate ?? this.toIsoDate(period.year, period.month, period.dayFrom),
      dateTo: range?.endDate ?? this.toIsoDate(period.year, period.month, period.dayTo),
    };
  });

  periodNote(granularity: PeriodGranularity): string {
    if (granularity === 'week') return 'календарная неделя · пн–вс';
    if (granularity === 'year') return 'YTD · KPI за год';
    return 'закрытые дни';
  }

  toIsoDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private persistChartPeriodForGranularity(
    granularity: PeriodGranularity,
    force = false,
  ): void {
    const current = this.chartPeriod();
    const bounds = this.chartDataBounds();
    const hasMonthMemory = Object.prototype.hasOwnProperty.call(this.chartPeriodMemory, 'month');
    const hasWeekMemory = Object.prototype.hasOwnProperty.call(this.chartPeriodMemory, 'week');
    const hasYearMemory = Object.prototype.hasOwnProperty.call(this.chartPeriodMemory, 'year');

    if (granularity === 'year') {
      if (!current && !hasYearMemory && !force) return;
      this.chartPeriodMemory.year = current?.year ?? null;
      return;
    }

    if (granularity === 'month') {
      if (!current && !hasMonthMemory && !force) return;
      this.chartPeriodMemory.month = current?.month ?? null;
      return;
    }

    if (!current?.weekStartDate || !current.weekEndDate) {
      if (!hasWeekMemory && !force) return;
      this.chartPeriodMemory.week = null;
      return;
    }

    this.chartPeriodMemory.week = weekIndexInMonth(
      current.year,
      current.month,
      bounds,
      { startDate: current.weekStartDate, endDate: current.weekEndDate },
    );
  }

  private resolveWeekContextMonth(
    year: number,
    bounds: DataBoundsV2 | null,
    dashboardPeriod: DashboardV2['period'],
    current: ChartPeriodSelection | null,
    prev: PeriodGranularity,
  ): number {
    const memorizedMonth = this.chartPeriodMemory.month;
    if (memorizedMonth != null) {
      return clampChartMonthInYear(year, memorizedMonth, bounds);
    }
    if (prev === 'month' && current?.month != null) {
      return clampChartMonthInYear(year, current.month, bounds);
    }
    return clampChartMonthInYear(
      year,
      resolveDefaultChartMonth(year, bounds, dashboardPeriod),
      bounds,
    );
  }

  private restoreChartPeriodForGranularity(
    prev: PeriodGranularity,
    next: PeriodGranularity,
  ): void {
    const dashboardPeriod = this.dashboardPeriod();
    if (!dashboardPeriod) return;

    const bounds = this.chartDataBounds();
    const current = this.chartPeriod();

    if (next === 'year') {
      const memorizedYear = this.chartPeriodMemory.year;
      if (memorizedYear !== undefined) {
        if (memorizedYear != null) {
          this.chartPeriod.set({ year: memorizedYear, month: 1 });
        } else {
          this.chartPeriod.set(null);
        }
      } else {
        const year = current?.year ?? dashboardPeriod.year;
        this.chartPeriod.set({ year, month: 1 });
      }
      this.normalizeChartPeriodToImplicitLatest();
      return;
    }

    if (next === 'month') {
      const year = current?.year ?? dashboardPeriod.year;
      const memorizedMonth = this.chartPeriodMemory.month;
      if (memorizedMonth !== undefined) {
        if (memorizedMonth != null) {
          const month = clampChartMonthInYear(year, memorizedMonth, bounds);
          this.chartPeriod.set({ year, month });
        } else {
          this.chartPeriod.set(null);
        }
        this.normalizeChartPeriodToImplicitLatest();
        return;
      }

      const month = resolveDefaultChartMonth(year, bounds, dashboardPeriod);
      this.chartPeriod.set({ year, month });
      this.normalizeChartPeriodToImplicitLatest();
      return;
    }

    const year = current?.year ?? dashboardPeriod.year;
    const memorizedWeekIndex = this.chartPeriodMemory.week;
    const month = this.resolveWeekContextMonth(
      year,
      bounds,
      dashboardPeriod,
      current,
      prev,
    );

    if (memorizedWeekIndex !== undefined) {
      if (memorizedWeekIndex != null) {
        const week = resolveWeekByIndexInMonth(year, month, bounds, memorizedWeekIndex);
        this.chartPeriod.set({
          year,
          month: week.month,
          weekStartDate: week.startDate,
          weekEndDate: week.endDate,
        });
      } else {
        this.chartPeriod.set(null);
      }
      this.normalizeChartPeriodToImplicitLatest();
      return;
    }

    const week = resolveDefaultWeekForMonth(year, month, bounds, dashboardPeriod);
    this.chartPeriod.set({
      year,
      month,
      weekStartDate: week.startDate,
      weekEndDate: week.endDate,
    });
    this.normalizeChartPeriodToImplicitLatest();
  }
}

import { computed, effect, Injectable, signal, untracked } from '@angular/core';

import type { ChartDisplayMode, PeriodGranularity } from '../../shared/models/common.model';
import type {
  ChartPeriodSelection,
  ChartPeriodMonthMemory,
  ChartPeriodWeekMemory,
} from '../../shared/models/chart-period.model';
import type { DashboardApi, DataBounds } from '../../shared/models/dashboard-api.model';
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
import {
  buildChartDataframeContext,
  isCompareSelectionSameAsDataframe,
  compareSelectionToApiPeriod,
  apiPeriodToCompareSelection,
} from '../../shared/utils/compare-period.utils';
import { inferPendingChartPeriod } from '../../shared/utils/period-format.utils';

export type { ChartPeriodSelection } from '../../shared/models/chart-period.model';

export interface DateRangeQuery {
  dateFrom: string;
  dateTo: string;
}

@Injectable({ providedIn: 'root' })
export class PeriodService {
  readonly granularity = signal<PeriodGranularity>('month');
  readonly chartDisplayMode = signal<ChartDisplayMode>('day');
  readonly dashboardPeriod = signal<DashboardApi['period'] | null>(null);
  readonly chartDataBounds = signal<DashboardApi['dataBounds'] | null>(null);
  /** Выбранный период dashboard; null — последние данные из API. */
  readonly chartPeriod = signal<ChartPeriodSelection | null>(null);
  /** Кастомный LfL compare; null — предыдущий период (дефолт API). */
  readonly comparePeriod = signal<ChartPeriodSelection | null>(null);

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
          if (next === 'year') {
            this.comparePeriod.set(null);
          } else if (prev !== 'year') {
            this.normalizeComparePeriodForGranularity(next);
          }
          this.reconcileCompareWithChartPeriod();
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

    effect(() => {
      this.comparePeriod();
      this.chartPeriod();
      this.dashboardPeriod();
      this.granularity();
      untracked(() => this.reconcileCompareWithChartPeriod());
    });
  }

  /** Полный сброс chart/dashboard period state (logout, tenant switch). */
  reset(): void {
    this.granularity.set('month');
    this.chartDisplayMode.set('day');
    this.dashboardPeriod.set(null);
    this.chartDataBounds.set(null);
    this.chartPeriod.set(null);
    this.comparePeriod.set(null);
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
    this.reconcileCompareWithChartPeriod();
  }

  clearChartPeriod(): void {
    this.chartPeriod.set(null);
    this.persistChartPeriodForGranularity(this.granularity(), true);
    this.reconcileCompareWithChartPeriod();
  }

  applyComparePeriod(selection: ChartPeriodSelection): void {
    const granularity = this.granularity();
    if (granularity === 'year') {
      this.comparePeriod.set({ year: selection.year, month: 1 });
      return;
    }
    if (
      granularity === 'week' &&
      selection.weekStartDate &&
      selection.weekEndDate
    ) {
      this.comparePeriod.set({
        year: selection.year,
        month: selection.month,
        weekStartDate: selection.weekStartDate,
        weekEndDate: selection.weekEndDate,
      });
      return;
    }
    this.comparePeriod.set({ year: selection.year, month: selection.month });
  }

  resetComparePeriod(): void {
    this.comparePeriod.set(null);
  }

  /** @deprecated alias */
  clearComparePeriod(): void {
    this.resetComparePeriod();
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
    this.reconcileCompareWithChartPeriod();
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

  /** При смене month ↔ week приводит comparePeriod к форме, ожидаемой granularity. */
  private normalizeComparePeriodForGranularity(next: PeriodGranularity): void {
    const compare = this.comparePeriod();
    if (!compare) return;

    if (next === 'week' && (!compare.weekStartDate || !compare.weekEndDate)) {
      const dashboardPeriod = this.dashboardPeriod();
      if (!dashboardPeriod) {
        this.resetComparePeriod();
        return;
      }
      const chartPeriod = this.chartPeriod() ?? {
        year: dashboardPeriod.year,
        month: dashboardPeriod.month,
      };
      const primary = inferPendingChartPeriod(chartPeriod, 'week', dashboardPeriod);
      const apiCompare = compareSelectionToApiPeriod(compare, 'month', primary);
      this.comparePeriod.set(apiPeriodToCompareSelection(apiCompare, 'week'));
      return;
    }

    if (next === 'month' && compare.weekStartDate && compare.weekEndDate) {
      this.comparePeriod.set({ year: compare.year, month: compare.month });
    }
  }

  /** Сбрасывает кастомный LfL, если он совпал с текущим датафреймом. */
  private reconcileCompareWithChartPeriod(): void {
    const compare = this.comparePeriod();
    if (!compare) return;

    const granularity = this.granularity();
    if (granularity === 'year') return;

    const dashboardPeriod = this.dashboardPeriod();
    if (!dashboardPeriod) return;

    const dataframe = buildChartDataframeContext(
      this.chartPeriod(),
      granularity,
      dashboardPeriod,
    );

    if (isCompareSelectionSameAsDataframe(compare, granularity, dataframe)) {
      this.resetComparePeriod();
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
    bounds: DataBounds | null,
    dashboardPeriod: DashboardApi['period'],
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
      this.reconcileCompareWithChartPeriod();
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
        this.reconcileCompareWithChartPeriod();
        return;
      }

      const month = resolveDefaultChartMonth(year, bounds, dashboardPeriod);
      this.chartPeriod.set({ year, month });
      this.normalizeChartPeriodToImplicitLatest();
      this.reconcileCompareWithChartPeriod();
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
      this.reconcileCompareWithChartPeriod();
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
    this.reconcileCompareWithChartPeriod();
  }
}

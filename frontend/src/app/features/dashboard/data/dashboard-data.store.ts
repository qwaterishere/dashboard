import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ANALYTICS_CACHE_CONFIG } from '../../../core/config/analytics-cache.config';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import {
  analyticsTenantScope,
  buildDashboardCacheKey,
  chartSelectionToQuery,
} from '../../../core/data/analytics-cache-key';
import { DashboardCache } from '../../../core/data/dashboard-cache.service';
import { DashboardRepository } from '../../../core/data/dashboard.repository';
import { PeriodService } from '../../../core/services/period.service';
import type { ChartPeriodSelection } from '../../../shared/models/chart-period.model';
import type { PeriodGranularity, PeriodInfo } from '../../../shared/models/common.model';
import type { DashboardV2, RevenueDayV2 } from '../../../shared/models/dashboard-v2.model';
import { buildPeriodInfo, formatChartPeriodLabel, formatYearPeriodLabel, monthRangeFromSeries } from '../../../shared/utils/period-format.utils';
import { isChartPeriodResetVisible, monthKeysInIsoRange, resolveChartWeekRange } from '../../../shared/utils/chart-period.utils';
import { WarehouseDataStore } from '../../warehouse/data/warehouse-data.store';
import {
  chartFetchNeeded,
  pickDashboardChartSlice,
  applyWeekTimeframeKpis,
  applyYearTimeframeKpis,
  isChartSliceReady,
  resolveEffectiveChartSelection,
  resolveMergedChartData,
} from './dashboard-chart.utils';
import { buildDashboardViewModel, buildStockFromWarehouse } from './dashboard-v2.utils';
import type { DashboardData } from '../../../shared/models/dashboard.model';

const LOADING: PeriodInfo = { label: '…', note: 'загрузка' };
const ERROR: PeriodInfo = { label: '—', note: 'нет данных' };

export interface DashboardChartPickerConfig {
  label: string;
  note: string;
  granularity: PeriodGranularity;
  bounds: DashboardV2['dataBounds'];
  activePeriod: { year: number; month: number; dayFrom: number; dayTo: number };
  selection: ChartPeriodSelection | null;
  showReset: boolean;
}

export interface DashboardResourceFacade {
  hasValue(): boolean;
  value(): DashboardV2;
  error(): unknown | null;
  isLoading(): boolean;
  reload(): void;
}

@Injectable({ providedIn: 'root' })
export class DashboardDataStore {
  private readonly auth = inject(AuthService);
  private readonly periodService = inject(PeriodService);
  private readonly warehouseStore = inject(WarehouseDataStore);
  private readonly sync = inject(AnalyticsDataSyncService);
  private readonly cache = inject(DashboardCache);
  private readonly repository = inject(DashboardRepository);
  private readonly cacheConfig = inject(ANALYTICS_CACHE_CONFIG);

  private readonly baseData = signal<DashboardV2 | null>(null);
  private readonly baseError = signal<unknown | null>(null);
  private readonly baseLoading = signal(false);

  /** Bumps when chart cache entries change so viewModel re-reads peek(). */
  private readonly chartCacheRevision = signal(0);
  /** Key currently awaiting first load (no cached body yet). */
  private readonly chartLoadingKey = signal<string | null>(null);

  private readonly stableViewModel = signal<DashboardData | null>(null);
  private latestRequestId = 0;

  readonly dashboard: DashboardResourceFacade = {
    hasValue: () => this.baseData() !== null,
    value: () => this.baseData()!,
    error: () => this.baseError(),
    isLoading: () => this.baseLoading(),
    reload: () => {
      void this.reloadLatest(true);
    },
  };

  readonly warehouse = this.warehouseStore.data;
  readonly granularity = this.periodService.granularity;

  readonly period = computed<PeriodInfo>(() => {
    const data = this.baseData();
    const granularity = this.granularity();
    if (data) {
      const { period, compare, revenueByMonth } = data;
      const base = buildPeriodInfo(period, compare);
      if (granularity === 'year') {
        const monthRange = monthRangeFromSeries(revenueByMonth ?? []);
        return {
          ...base,
          label: monthRange
            ? formatYearPeriodLabel(period.year, monthRange.from, monthRange.to)
            : String(period.year),
          compareWith: String(compare.year),
          note: this.periodService.periodNote(granularity),
        };
      }
      return { ...base, note: this.periodService.periodNote(granularity) };
    }
    if (this.baseError()) return ERROR;
    if (this.baseLoading()) return LOADING;
    return LOADING;
  });

  readonly chartLoadingState = computed(() => {
    const key = this.currentChartCacheKey();
    if (!key) return false;
    if (this.cache.peek(key)) return false;

    const base = this.baseData();
    const granularity = this.granularity();
    if (base && granularity === 'year') {
      const effectiveSelection = resolveEffectiveChartSelection(
        this.periodService.chartPeriod(),
        granularity,
        base.period,
      );
      if (
        effectiveSelection.year === base.period.year &&
        (base.revenueByMonth?.length ?? 0) > 0
      ) {
        return false;
      }
    }

    return this.chartLoadingKey() === key;
  });

  /** KPI cards depend on the chart slice; true while slice for the picker is not ready yet. */
  readonly kpiLoadingState = computed(() => {
    // Map cache is not reactive — bump revision when entries change.
    this.chartCacheRevision();

    const base = this.baseData();
    if (!base) return false;

    const selection = this.periodService.chartPeriod();
    const granularity = this.granularity();
    const effectiveSelection = resolveEffectiveChartSelection(
      selection,
      granularity,
      base.period,
    );
    const cacheKey = this.currentChartCacheKey();
    const cached = cacheKey ? this.cache.peek(cacheKey)?.data : undefined;
    const slice = cached ? pickDashboardChartSlice(cached) : null;

    return !isChartSliceReady(base, effectiveSelection, granularity, slice, cacheKey);
  });

  readonly salesQuery = this.periodService.salesQuery;

  /** Label + note для period bar dashboard (единый источник). */
  readonly chartPeriodBarInfo = computed<PeriodInfo>(() => {
    const vm = this.displayedViewModel();
    const granularity = this.granularity();
    if (vm) {
      return {
        label: vm.period.label,
        note: this.periodService.periodNote(granularity),
        compareWith: vm.period.compareWith,
      };
    }
    return this.period();
  });

  readonly chartPickerConfig = computed((): DashboardChartPickerConfig | null => {
    const vm = this.displayedViewModel();
    if (!vm) return null;

    const granularity = this.granularity();
    const period = vm.chartPeriod;

    return {
      label: vm.period.label,
      note: this.periodService.periodNote(granularity),
      granularity,
      bounds: vm.dataBounds ?? null,
      activePeriod: {
        year: period.year,
        month: period.month,
        dayFrom: period.dayFrom,
        dayTo: period.dayTo,
      },
      selection: this.periodService.chartPeriod(),
      showReset: isChartPeriodResetVisible(
        this.periodService.chartPeriod(),
        granularity,
        vm.dataBounds ?? null,
        this.periodService.dashboardPeriod(),
      ),
    };
  });

  readonly viewModel = computed(() => this.buildViewModel());

  readonly displayedViewModel = computed(
    () => this.viewModel() ?? this.stableViewModel(),
  );

  constructor() {
    this.sync.register('dashboard', this.dashboard);

    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId) {
        untracked(() => this.resetState());
        return;
      }
      untracked(() => {
        void this.ensureLatestLoaded(false);
      });
    });

    effect(() => {
      const userId = this.auth.user()?.id;
      const base = this.baseData();
      const selection = this.periodService.chartPeriod();
      const granularity = this.granularity();

      if (!userId || !base || !chartFetchNeeded(selection, granularity, base.period)) {
        untracked(() => this.chartLoadingKey.set(null));
        return;
      }

      const effectiveSelection = resolveEffectiveChartSelection(
        selection,
        granularity,
        base.period,
      );
      const key = buildDashboardCacheKey(
        analyticsTenantScope(userId),
        chartSelectionToQuery(effectiveSelection, granularity),
      );

      untracked(() => {
        void this.ensureChartLoaded(key);
        if (
          granularity === 'week' &&
          selection?.weekStartDate &&
          selection.weekEndDate
        ) {
          for (const { year, month } of monthKeysInIsoRange(
            selection.weekStartDate,
            selection.weekEndDate,
          )) {
            const monthKey = buildDashboardCacheKey(analyticsTenantScope(userId), {
              year,
              month,
            });
            if (monthKey !== key) {
              void this.ensureChartLoaded(monthKey);
            }
          }
        }
      });
    });

    effect(() => {
      const resource = this.baseData();
      if (resource) {
        untracked(() => {
          this.periodService.dashboardPeriod.set(resource.period);
          this.periodService.chartDataBounds.set(resource.dataBounds);
        });
      }
    });

    effect(() => {
      const vm = this.viewModel();
      if (!vm || !this.isViewModelStable()) return;
      untracked(() => this.stableViewModel.set(vm));
    });
  }

  private isViewModelStable(): boolean {
    const base = this.baseData();
    if (!base) return false;

    const selection = this.periodService.chartPeriod();
    const granularity = this.granularity();
    const effectiveSelection = resolveEffectiveChartSelection(
      selection,
      granularity,
      base.period,
    );
    const cacheKey = this.currentChartCacheKey();
    const cached = cacheKey ? this.cache.peek(cacheKey)?.data : undefined;
    const slice = cached ? pickDashboardChartSlice(cached) : null;

    return isChartSliceReady(base, effectiveSelection, granularity, slice, cacheKey);
  }

  private buildViewModel(): DashboardData | null {
    if (!this.baseData()) return null;

    // Subscribe to cache mutations (Map is not reactive).
    this.chartCacheRevision();

    const base = this.baseData()!;
    const granularity = this.granularity();
    const chartSelection = this.periodService.chartPeriod();
    const effectiveSelection = resolveEffectiveChartSelection(
      chartSelection,
      granularity,
      base.period,
    );
    const cacheKey = this.currentChartCacheKey();
    const cached = cacheKey ? this.cache.peek(cacheKey)?.data : undefined;
    const slice = cached ? pickDashboardChartSlice(cached) : null;
    let data = resolveMergedChartData(
      base,
      effectiveSelection,
      granularity,
      slice,
      cacheKey,
    );

    const monthRange = monthRangeFromSeries(data.revenueByMonth ?? []);
    const weekRange =
      granularity === 'week' ? resolveChartWeekRange(chartSelection, data.period) : undefined;
    const weekDayLookup =
      granularity === 'week' && weekRange ? this.createWeekDayLookup(data) : undefined;

    if (granularity === 'week') {
      data = applyWeekTimeframeKpis(data, weekRange, weekDayLookup);
    } else if (granularity === 'year') {
      const yearSliceReady =
        slice &&
        cacheKey &&
        slice.period.year === effectiveSelection.year;
      if (!yearSliceReady && effectiveSelection.year === base.period.year) {
        data = applyYearTimeframeKpis(data);
      }
    }

    const stock = this.warehouse.hasValue()
      ? buildStockFromWarehouse(this.warehouse.value())
      : null;

    return buildDashboardViewModel(data, {
      granularity,
      chartDisplayMode: this.periodService.chartDisplayMode(),
      stock,
      weekRange,
      weekDayLookup,
      chartPeriodLabel: formatChartPeriodLabel(
        data.period,
        granularity,
        monthRange ?? undefined,
        weekRange,
      ),
    });
  }

  private currentChartCacheKey(): string | null {
    const userId = this.auth.user()?.id;
    const selection = this.periodService.chartPeriod();
    const granularity = this.granularity();
    const base = this.baseData();
    if (!userId || !base || !chartFetchNeeded(selection, granularity, base.period)) {
      return null;
    }
    const effectiveSelection = resolveEffectiveChartSelection(
      selection,
      granularity,
      base.period,
    );
    return buildDashboardCacheKey(
      analyticsTenantScope(userId),
      chartSelectionToQuery(effectiveSelection, granularity),
    );
  }

  private tenantScope(): string {
    return analyticsTenantScope(this.auth.user()?.id);
  }

  private async ensureLatestLoaded(force: boolean): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;

    const key = buildDashboardCacheKey(this.tenantScope(), {});
    if (!force && this.cache.isFresh(key, this.cacheConfig.staleAfterMs) && this.baseData()) {
      return;
    }

    const requestId = ++this.latestRequestId;
    this.baseLoading.set(true);
    this.baseError.set(null);

    try {
      const hit = await this.cache.getOrLoad(
        key,
        (etag) => firstValueFrom(this.repository.fetch({}, { etag })),
        force ? 0 : this.cacheConfig.staleAfterMs,
      );
      if (requestId !== this.latestRequestId) return;
      this.baseData.set(hit.data);
    } catch (error) {
      if (requestId !== this.latestRequestId) return;
      this.baseError.set(error);
    } finally {
      if (requestId === this.latestRequestId) {
        this.baseLoading.set(false);
      }
    }
  }

  private async reloadLatest(force: boolean): Promise<void> {
    await this.ensureLatestLoaded(force);
  }

  private async ensureChartLoaded(key: string): Promise<void> {
    const stillSelected = () => this.currentChartCacheKey() === key;

    if (this.cache.isFresh(key, this.cacheConfig.staleAfterMs)) {
      if (stillSelected()) {
        this.chartCacheRevision.update((v) => v + 1);
      }
      return;
    }

    const awaitingFirstLoad = !this.cache.peek(key);
    if (awaitingFirstLoad && stillSelected()) {
      this.chartLoadingKey.set(key);
    }

    try {
      const query = this.parseQueryFromKey(key);
      await this.cache.getOrLoad(
        key,
        (etag) => firstValueFrom(this.repository.fetch(query, { etag })),
        this.cacheConfig.staleAfterMs,
      );
      if (stillSelected()) {
        this.chartCacheRevision.update((v) => v + 1);
      }
    } catch {
      // Keep stale-while-revalidate body if present; empty state otherwise.
    } finally {
      if (this.chartLoadingKey() === key) {
        this.chartLoadingKey.set(null);
      }
    }
  }

  private createWeekDayLookup(
    anchorData: DashboardV2,
  ): (year: number, month: number, day: number) => RevenueDayV2 | undefined {
    const tenant = this.tenantScope();
    return (year, month, day) => {
      if (year === anchorData.period.year && month === anchorData.period.month) {
        return anchorData.revenueByDay.find((entry) => entry.day === day);
      }
      const key = buildDashboardCacheKey(tenant, { year, month });
      return this.cache.peek(key)?.data.revenueByDay.find((entry) => entry.day === day);
    };
  }

  private parseQueryFromKey(key: string): { year?: number; month?: number } {
    const segments = key.split(':');
    if (segments[segments.length - 1] === 'latest') {
      return {};
    }

    const kind = segments[segments.length - 2];
    const value = segments[segments.length - 1] ?? '';

    if (kind === 'm') {
      const [year, month] = value.split('-').map(Number);
      return { year, month };
    }
    if (kind === 'y') {
      return { year: Number(value) };
    }
    return {};
  }

  private resetState(): void {
    this.latestRequestId += 1;
    this.baseData.set(null);
    this.baseError.set(null);
    this.baseLoading.set(false);
    this.chartLoadingKey.set(null);
    this.chartCacheRevision.update((v) => v + 1);
    this.stableViewModel.set(null);
    this.periodService.reset();
  }
}

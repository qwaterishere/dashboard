import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ANALYTICS_CACHE_CONFIG } from '../../../core/config/analytics-cache.config';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import {
  analyticsTenantScope,
  buildDashboardCacheKey,
  chartSelectionToQuery,
  mergeDashboardQueryWithCompare,
  parseDashboardCacheKey,
  type DashboardQueryKey,
} from '../../../core/data/analytics-cache-key';
import { DashboardCache } from '../../../core/data/dashboard-cache.service';
import { DashboardCompareCache } from '../../../core/data/dashboard-compare-cache.service';
import { DashboardRepository } from '../../../core/data/dashboard.repository';
import { FoodcostCache } from '../../../core/data/foodcost-cache.service';
import { FoodcostRepository } from '../../../core/data/foodcost.repository';
import { PeriodService } from '../../../core/services/period.service';
import type { ChartPeriodSelection } from '../../../shared/models/chart-period.model';
import type { PeriodGranularity, PeriodInfo } from '../../../shared/models/common.model';
import type { DashboardApi, ApiPeriod, RevenueDayFact } from '../../../shared/models/dashboard-api.model';
import { buildPeriodInfo, formatChartPeriodLabel, formatCompareWith, formatYearPeriodLabel, inferPendingChartPeriod, monthRangeFromSeries } from '../../../shared/utils/period-format.utils';
import { compareSelectionToApiPeriod, compareSelectionToDateRange, formatDataframePeriodLabel, resolveCompareActivePeriod, buildDataframePeriodContext } from '../../../shared/utils/compare-period.utils';
import { isChartPeriodResetVisible, monthKeysInIsoRange, resolveChartWeekRange } from '../../../shared/utils/chart-period.utils';
import { WarehouseDataStore } from '../../warehouse/data/warehouse-data.store';
import {
  chartFetchNeeded,
  pickDashboardChartSlice,
  mergeCompareOverlay,
  isCompareOverlayReady,
  applyYearTimeframeKpis,
  isChartSliceReady,
  resolveEffectiveChartSelection,
  resolveMergedChartData,
  type DashboardCompareSlice,
} from './dashboard-chart.utils';
import {
  buildDashboardChartCore,
  buildDashboardKpiLayer,
  buildStockFromWarehouse,
} from './dashboard.mapper';
import type { DashboardData } from '../../../shared/models/dashboard.model';

const LOADING: PeriodInfo = { label: '…', note: 'загрузка' };
const ERROR: PeriodInfo = { label: '—', note: 'нет данных' };

export interface DashboardComparePickerConfig {
  compareWith: string;
  granularity: PeriodGranularity;
  bounds: DashboardApi['dataBounds'];
  activePeriod: { year: number; month: number; dayFrom: number; dayTo: number };
  selection: ChartPeriodSelection | null;
  showReset: boolean;
  dataframePeriod: { year: number; month: number; dayFrom: number; dayTo: number };
  dataframeWeekRange?: { startDate: string; endDate: string };
  dataframePeriodLabel: string;
}

export interface DashboardChartPickerConfig {
  label: string;
  note: string;
  granularity: PeriodGranularity;
  bounds: DashboardApi['dataBounds'];
  activePeriod: { year: number; month: number; dayFrom: number; dayTo: number };
  selection: ChartPeriodSelection | null;
  showReset: boolean;
}

export interface DashboardResourceFacade {
  hasValue(): boolean;
  value(): DashboardApi;
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
  private readonly compareCache = inject(DashboardCompareCache);
  private readonly repository = inject(DashboardRepository);
  private readonly foodcostCache = inject(FoodcostCache);
  private readonly foodcostRepository = inject(FoodcostRepository);
  private readonly cacheConfig = inject(ANALYTICS_CACHE_CONFIG);

  private readonly baseData = signal<DashboardApi | null>(null);
  private readonly baseError = signal<unknown | null>(null);
  private readonly baseLoading = signal(false);

  /** Bumps when chart cache entries change so chart viewModel re-reads peek(). */
  private readonly chartCacheRevision = signal(0);
  /** Bumps when compare overlay cache changes (KPI LfL only). */
  private readonly compareCacheRevision = signal(0);
  /** Bumps when foodcost cache entries change so viewModel re-reads peek(). */
  private readonly foodcostCacheRevision = signal(0);
  /** Key currently awaiting first load (no cached body yet). */
  private readonly chartLoadingKey = signal<string | null>(null);
  /** Key awaiting first compare overlay load (custom LfL). */
  private readonly compareLoadingKey = signal<string | null>(null);
  /** Key awaiting first period KPI load (default LfL, no custom compare). */
  private readonly periodKpiLoadingKey = signal<string | null>(null);

  private readonly stableViewModel = signal<DashboardData | null>(null);
  private latestRequestId = 0;

  readonly dashboard: DashboardResourceFacade = {
    hasValue: () => this.baseData() !== null,
    value: () => this.baseData()!,
    error: () => this.baseError(),
    isLoading: () => this.baseLoading(),
    reload: () => {
      void this.reloadDashboard(true);
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
        base.dataBounds,
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

  /** KPI cards overlay — только пока грузится KPI-слой (не ждём chart). */
  readonly kpiChartLoadingState = computed(() => {
    this.compareCacheRevision();

    const base = this.baseData();
    if (!base) return false;

    // Custom compare — спиннер только в LfL badge.
    if (this.periodService.comparePeriod()) return false;

    return this.isDefaultPeriodKpiPending();
  });

  /** LfL badge spinner — пока грузится compare overlay (без dim всей карточки). */
  readonly compareLflLoadingState = computed(() => {
    const compareKey = this.currentCompareCacheKey();
    if (!compareKey) return false;

    this.compareCacheRevision();
    if (this.compareCache.peek(compareKey)) return false;

    return this.compareLoadingKey() === compareKey;
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

  readonly comparePickerConfig = computed((): DashboardComparePickerConfig | null => {
    const vm = this.displayedViewModel();
    const granularity = this.granularity();
    if (!vm || granularity === 'year' || !vm.period.compareWith) return null;

    const merged = this.mergedDashboardApi();
    if (!merged) return null;

    const active = resolveCompareActivePeriod(
      merged.compare,
      granularity,
      merged.weekKpi,
    );

    const compareSelection = this.periodService.comparePeriod();
    const compareWith =
      compareSelection && merged
        ? formatCompareWith(
            compareSelectionToApiPeriod(
              compareSelection,
              granularity,
              this.primaryPeriodForCompare(merged),
            ),
          )
        : vm.period.compareWith!;

    const chartPeriod = vm.chartPeriod;
    const dataframeContext = buildDataframePeriodContext(
      chartPeriod,
      granularity,
      this.periodService.chartPeriod(),
    );

    return {
      compareWith,
      granularity,
      bounds: vm.dataBounds ?? null,
      activePeriod: active,
      selection: this.periodService.comparePeriod(),
      showReset: this.periodService.comparePeriod() !== null,
      dataframePeriod: {
        year: chartPeriod.year,
        month: chartPeriod.month,
        dayFrom: chartPeriod.dayFrom,
        dayTo: chartPeriod.dayTo,
      },
      dataframeWeekRange: dataframeContext.weekRange,
      dataframePeriodLabel: formatDataframePeriodLabel(dataframeContext, granularity),
    };
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

  readonly chartViewModel = computed(() => this.buildChartViewModel());

  readonly displayedViewModel = computed(() => {
    const chartVm = this.chartViewModel();
    if (!chartVm) {
      return this.stableViewModel();
    }

    const compareKey = this.currentCompareCacheKey();
    const overlay = this.compareOverlaySlice();

    // Custom compare selected but overlay not cached yet — keep prior KPI/LfL visible.
    if (compareKey && !overlay) {
      const stable = this.stableViewModel();
      if (stable) {
        return this.applyStableKpiLayer(chartVm, stable);
      }
    }

    return chartVm;
  });

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
      this.periodService.chartPeriod();
      this.granularity();
      untracked(() => this.stableViewModel.set(null));
    });

    effect(() => {
      const userId = this.auth.user()?.id;
      const base = this.baseData();
      const compareSelection = this.periodService.comparePeriod();

      if (!userId || !base || !compareSelection) {
        untracked(() => this.compareLoadingKey.set(null));
        return;
      }

      const key = this.currentCompareCacheKey();
      if (!key) {
        untracked(() => this.compareLoadingKey.set(null));
        return;
      }

      untracked(() => {
        void this.ensureCompareLoaded(key);
      });
    });

    effect(() => {
      const userId = this.auth.user()?.id;
      const base = this.baseData();
      const granularity = this.granularity();

      if (!userId || !base) {
        untracked(() => this.chartLoadingKey.set(null));
        return;
      }

      const effectiveSelection = this.effectiveChartSelection();
      if (!this.needsChartDataFetch(effectiveSelection, granularity, base.period)) {
        untracked(() => this.chartLoadingKey.set(null));
        return;
      }

      const key = buildDashboardCacheKey(
        analyticsTenantScope(userId),
        this.buildChartQuery(effectiveSelection),
      );

      untracked(() => {
        void this.ensureChartLoaded(key);
        if (!this.periodService.comparePeriod()) {
          void this.ensurePeriodKpiLoaded(key);
        }
        if (granularity === 'week') {
          for (const { year, month } of monthKeysInIsoRange(
            effectiveSelection.weekStartDate!,
            effectiveSelection.weekEndDate!,
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
      const userId = this.auth.user()?.id;
      const base = this.baseData();
      this.periodService.chartPeriod();
      this.granularity();

      if (!userId || !base) return;

      const key = untracked(() => this.currentFoodcostCacheKey());
      untracked(() => {
        void this.ensureFoodcostLoaded(key);
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
      const vm = this.displayedViewModel();
      if (!vm || !this.isViewModelStable()) return;
      untracked(() => this.stableViewModel.set(vm));
    });
  }

  private isViewModelStable(): boolean {
    return this.isChartSliceStable() && this.isCompareOverlayStable();
  }

  private isChartSliceStable(): boolean {
    const base = this.baseData();
    if (!base) return false;

    const granularity = this.granularity();
    const effectiveSelection = this.effectiveChartSelection();
    const cacheKey = this.currentChartCacheKey();
    const cached = cacheKey ? this.cache.peek(cacheKey)?.data : undefined;
    const slice = cached ? pickDashboardChartSlice(cached) : null;

    return isChartSliceReady(
      base,
      effectiveSelection,
      granularity,
      slice,
      cacheKey,
    );
  }

  private isCompareOverlayStable(): boolean {
    const compareKey = this.currentCompareCacheKey();
    if (compareKey) {
      return isCompareOverlayReady(compareKey, Boolean(this.compareCache.peek(compareKey)));
    }
    return !this.isDefaultPeriodKpiPending();
  }

  private isDefaultPeriodKpiPending(): boolean {
    if (this.periodService.comparePeriod()) return false;

    const base = this.baseData();
    if (!base) return false;

    const granularity = this.granularity();
    const effectiveSelection = this.effectiveChartSelection();
    if (!chartFetchNeeded(effectiveSelection, granularity, base.period)) {
      return false;
    }

    const chartKey = this.currentChartCacheKey();
    if (!chartKey) return false;

    return !this.compareCache.peek(chartKey);
  }

  private mergedChartApi(): DashboardApi | null {
    if (!this.baseData()) return null;
    this.chartCacheRevision();
    const base = this.baseData()!;
    const granularity = this.granularity();
    const effectiveSelection = this.effectiveChartSelection();
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

    if (granularity === 'year') {
      const yearSliceReady =
        slice &&
        cacheKey &&
        slice.period.year === effectiveSelection.year;
      if (!yearSliceReady && effectiveSelection.year === base.period.year) {
        data = applyYearTimeframeKpis(data);
      }
    }

    const compareKey = this.currentCompareCacheKey();
    if (compareKey) {
      const overlay = this.compareOverlaySlice();
      if (overlay) {
        data = mergeCompareOverlay(data, overlay);
      }
    } else if (cacheKey) {
      this.compareCacheRevision();
      const periodKpi = this.compareCache.peek(cacheKey)?.data;
      if (periodKpi) {
        data = mergeCompareOverlay(data, periodKpi);
      }
    }

    return data;
  }

  private compareOverlaySlice(): DashboardCompareSlice | null {
    const compareKey = this.currentCompareCacheKey();
    if (!compareKey) return null;
    this.compareCacheRevision();
    return this.compareCache.peek(compareKey)?.data ?? null;
  }

  private mergedDashboardApi(): DashboardApi | null {
    return this.mergedChartApi();
  }

  private needsChartDataFetch(
    selection: ChartPeriodSelection,
    granularity: PeriodGranularity,
    basePeriod: DashboardApi['period'],
  ): boolean {
    return chartFetchNeeded(selection, granularity, basePeriod);
  }

  private primaryPeriodForCompare(base: DashboardApi): ApiPeriod {
    const effectiveSelection = this.effectiveChartSelection();
    const granularity = this.granularity();
    if (!chartFetchNeeded(effectiveSelection, granularity, base.period)) {
      return base.period;
    }
    return inferPendingChartPeriod(effectiveSelection, granularity, base.period);
  }

  private buildChartQuery(effectiveSelection: ChartPeriodSelection): DashboardQueryKey {
    const base = this.baseData();
    const granularity = this.granularity();
    if (
      base &&
      !this.periodService.chartPeriod() &&
      !chartFetchNeeded(effectiveSelection, granularity, base.period)
    ) {
      return {};
    }
    return chartSelectionToQuery(effectiveSelection, granularity);
  }

  private buildCompareQuery(effectiveSelection: ChartPeriodSelection): DashboardQueryKey {
    const base = this.baseData();
    if (!base) {
      return this.buildChartQuery(effectiveSelection);
    }
    const query = this.buildChartQuery(effectiveSelection);
    const compareSelection = this.periodService.comparePeriod();
    if (!compareSelection) {
      return query;
    }
    const range = compareSelectionToDateRange(
      compareSelection,
      this.granularity(),
      this.primaryPeriodForCompare(base),
    );
    return mergeDashboardQueryWithCompare(query, range);
  }

  private viewModelOptions(
    data: DashboardApi,
    weekRange?: ReturnType<typeof resolveChartWeekRange>,
    weekDayLookup?: ReturnType<typeof this.createWeekDayLookup>,
  ) {
    const granularity = this.granularity();
    const stock = this.warehouse.hasValue()
      ? buildStockFromWarehouse(this.warehouse.value())
      : null;

    this.foodcostCacheRevision();
    const foodcostKey = this.currentFoodcostCacheKey();
    const foodcost = this.foodcostCache.peek(foodcostKey)?.data ?? null;
    const monthRange = monthRangeFromSeries(data.revenueByMonth ?? []);

    return {
      granularity,
      chartDisplayMode: this.periodService.chartDisplayMode(),
      stock,
      foodcost,
      weekRange,
      weekDayLookup,
      weekKpi: granularity === 'week' ? data.weekKpi ?? null : null,
      chartPeriodLabel: formatChartPeriodLabel(
        data.period,
        granularity,
        monthRange ?? undefined,
        weekRange,
      ),
    };
  }

  private applyStableKpiLayer(chartVm: DashboardData, stable: DashboardData): DashboardData {
    return {
      ...chartVm,
      period: {
        ...chartVm.period,
        compareWith: stable.period.compareWith,
      },
      kpis: stable.kpis,
      details: stable.details,
    };
  }

  private buildChartViewModel(): DashboardData | null {
    const data = this.mergedChartApi();
    if (!data || !this.baseData()) return null;

    const granularity = this.granularity();
    const effectiveSelection = this.effectiveChartSelection();
    const weekRange =
      granularity === 'week'
        ? resolveChartWeekRange(effectiveSelection, data.period)
        : undefined;
    const weekDayLookup =
      granularity === 'week' && weekRange ? this.createWeekDayLookup(data) : undefined;

    const options = this.viewModelOptions(data, weekRange, weekDayLookup);
    const chartCore = buildDashboardChartCore(data, options);
    const kpiLayer = buildDashboardKpiLayer(data, options);

    return {
      ...chartCore,
      period: {
        ...chartCore.period,
        compareWith: kpiLayer.period.compareWith,
      },
      kpis: kpiLayer.kpis,
      details: kpiLayer.details,
    };
  }

  private currentFoodcostCacheKey(): string {
    const base = this.baseData();
    if (!base) {
      return buildDashboardCacheKey(this.tenantScope(), {});
    }
    const effectiveSelection = this.effectiveChartSelection();
    return buildDashboardCacheKey(
      this.tenantScope(),
      chartSelectionToQuery(
        effectiveSelection,
        this.granularity() === 'week' ? 'month' : this.granularity(),
      ),
    );
  }

  private effectiveChartSelection(): ChartPeriodSelection {
    const base = this.baseData();
    if (!base) {
      return { year: 2026, month: 1 };
    }
    return resolveEffectiveChartSelection(
      this.periodService.chartPeriod(),
      this.granularity(),
      base.period,
      base.dataBounds,
    );
  }

  private async ensureFoodcostLoaded(key: string): Promise<void> {
    if (this.foodcostCache.isFresh(key, this.cacheConfig.staleAfterMs)) {
      this.foodcostCacheRevision.update((value) => value + 1);
      return;
    }

    try {
      const query = parseDashboardCacheKey(key);
      await this.foodcostCache.getOrLoad(
        key,
        (etag) => firstValueFrom(this.foodcostRepository.fetch(query, { etag })),
        this.cacheConfig.staleAfterMs,
      );
      this.foodcostCacheRevision.update((value) => value + 1);
    } catch {
      // stale-while-revalidate: keep prior cache body if any
    }
  }

  private currentChartCacheKey(): string | null {
    const userId = this.auth.user()?.id;
    const granularity = this.granularity();
    const base = this.baseData();
    if (!userId || !base) {
      return null;
    }
    const effectiveSelection = this.effectiveChartSelection();
    if (!this.needsChartDataFetch(effectiveSelection, granularity, base.period)) {
      return null;
    }
    return buildDashboardCacheKey(
      analyticsTenantScope(userId),
      this.buildChartQuery(effectiveSelection),
    );
  }

  private currentCompareCacheKey(): string | null {
    if (!this.periodService.comparePeriod()) return null;

    const userId = this.auth.user()?.id;
    const base = this.baseData();
    if (!userId || !base) return null;

    return buildDashboardCacheKey(
      analyticsTenantScope(userId),
      this.buildCompareQuery(this.effectiveChartSelection()),
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

  private async reloadDashboard(force: boolean): Promise<void> {
    const tenant = this.tenantScope();
    const latestKey = buildDashboardCacheKey(tenant, {});

    await this.ensureLatestLoaded(force);

    if (force) {
      this.cache.markTenantStale(tenant, latestKey);
      this.compareCache.markTenantStale(tenant);
    }

    const chartKey = this.currentChartCacheKey();
    if (chartKey) {
      await this.ensureChartLoaded(chartKey, force);
      if (!this.currentCompareCacheKey()) {
        await this.ensurePeriodKpiLoaded(chartKey, force);
      }
    }

    const compareKey = this.currentCompareCacheKey();
    if (compareKey) {
      await this.ensureCompareLoaded(compareKey, force);
    }
  }

  private async ensureChartLoaded(key: string, force = false): Promise<void> {
    const stillSelected = () => this.currentChartCacheKey() === key;

    if (!force && this.cache.isFresh(key, this.cacheConfig.staleAfterMs)) {
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
      const query = parseDashboardCacheKey(key);
      await this.cache.getOrLoad(
        key,
        (etag) => firstValueFrom(this.repository.fetchChart(query, { etag })),
        force ? 0 : this.cacheConfig.staleAfterMs,
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

  private async ensurePeriodKpiLoaded(key: string, force = false): Promise<void> {
    if (this.periodService.comparePeriod()) return;

    const stillSelected = () =>
      !this.periodService.comparePeriod() && this.currentChartCacheKey() === key;

    if (!force && this.compareCache.isFresh(key, this.cacheConfig.staleAfterMs)) {
      if (stillSelected()) {
        this.compareCacheRevision.update((v) => v + 1);
      }
      return;
    }

    const awaitingFirstLoad = !this.compareCache.peek(key);
    if (awaitingFirstLoad && stillSelected()) {
      this.periodKpiLoadingKey.set(key);
    }

    try {
      const query = parseDashboardCacheKey(key);
      const periodQuery: DashboardQueryKey = {
        year: query.year,
        month: query.month,
        weekStart: query.weekStart,
        weekEnd: query.weekEnd,
      };
      await this.compareCache.getOrLoad(
        key,
        (etag) => firstValueFrom(this.repository.fetchKpi(periodQuery, { etag })),
        force ? 0 : this.cacheConfig.staleAfterMs,
      );
      if (stillSelected()) {
        this.compareCacheRevision.update((v) => v + 1);
      }
    } catch {
      // Keep stale period KPI if present.
    } finally {
      if (this.periodKpiLoadingKey() === key) {
        this.periodKpiLoadingKey.set(null);
      }
    }
  }

  private async ensureCompareLoaded(key: string, force = false): Promise<void> {
    const stillSelected = () => this.currentCompareCacheKey() === key;

    if (!force && this.compareCache.isFresh(key, this.cacheConfig.staleAfterMs)) {
      if (stillSelected()) {
        this.compareCacheRevision.update((v) => v + 1);
      }
      return;
    }

    const awaitingFirstLoad = !this.compareCache.peek(key);
    if (awaitingFirstLoad && stillSelected()) {
      this.compareLoadingKey.set(key);
    }

    try {
      const query = parseDashboardCacheKey(key);
      await this.compareCache.getOrLoad(
        key,
        (etag) => firstValueFrom(this.repository.fetchKpi(query, { etag })),
        force ? 0 : this.cacheConfig.staleAfterMs,
      );
      if (stillSelected()) {
        this.compareCacheRevision.update((v) => v + 1);
      }
    } catch {
      // Keep stale compare overlay if present.
    } finally {
      if (this.compareLoadingKey() === key) {
        this.compareLoadingKey.set(null);
      }
    }
  }

  private createWeekDayLookup(
    anchorData: DashboardApi,
  ): (year: number, month: number, day: number) => RevenueDayFact | undefined {
    const tenant = this.tenantScope();
    return (year, month, day) => {
      if (year === anchorData.period.year && month === anchorData.period.month) {
        return anchorData.revenueByDay.find((entry) => entry.day === day);
      }
      const key = buildDashboardCacheKey(tenant, { year, month });
      return this.cache.peek(key)?.data.revenueByDay.find((entry) => entry.day === day);
    };
  }

  private resetState(): void {
    this.latestRequestId += 1;
    this.baseData.set(null);
    this.baseError.set(null);
    this.baseLoading.set(false);
    this.chartLoadingKey.set(null);
    this.compareLoadingKey.set(null);
    this.periodKpiLoadingKey.set(null);
    this.chartCacheRevision.update((v) => v + 1);
    this.compareCacheRevision.update((v) => v + 1);
    this.foodcostCacheRevision.update((v) => v + 1);
    this.stableViewModel.set(null);
    this.periodService.reset();
    this.cache.clearAll();
    this.compareCache.clearAll();
    this.foodcostCache.clearAll();
  }
}

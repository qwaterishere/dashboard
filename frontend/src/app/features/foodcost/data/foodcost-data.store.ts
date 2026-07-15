import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ANALYTICS_CACHE_CONFIG } from '../../../core/config/analytics-cache.config';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import {
  analyticsTenantScope,
  buildDashboardCacheKey,
} from '../../../core/data/analytics-cache-key';
import { FoodcostCache } from '../../../core/data/foodcost-cache.service';
import { FoodcostRepository } from '../../../core/data/foodcost.repository';
import { PeriodService } from '../../../core/services/period.service';
import type { PeriodInfo } from '../../../shared/models/common.model';
import type { FoodcostData } from '../../../shared/models/foodcost.model';
import type { FoodcostApi } from '../../../shared/models/foodcost-api.model';
import { buildFoodcostPeriodInfo, buildFoodcostViewModel } from './foodcost.mapper';
import { resolveFoodcostQuery } from './foodcost-query.utils';

const LOADING: PeriodInfo = { label: '…', note: 'загрузка' };
const ERROR: PeriodInfo = { label: '—', note: 'нет данных' };

export interface FoodcostResourceFacade {
  hasValue(): boolean;
  value(): FoodcostData;
  error(): unknown | null;
  isLoading(): boolean;
  reload(): void;
}

@Injectable({ providedIn: 'root' })
export class FoodcostDataStore {
  private readonly auth = inject(AuthService);
  private readonly periodService = inject(PeriodService);
  private readonly sync = inject(AnalyticsDataSyncService);
  private readonly cache = inject(FoodcostCache);
  private readonly repository = inject(FoodcostRepository);
  private readonly cacheConfig = inject(ANALYTICS_CACHE_CONFIG);

  private readonly rawData = signal<FoodcostApi | null>(null);
  private readonly loadError = signal<unknown | null>(null);
  private readonly loading = signal(false);
  private latestRequestId = 0;

  readonly granularity = this.periodService.granularity;

  readonly data: FoodcostResourceFacade = {
    hasValue: () => this.viewModel() !== null,
    value: () => this.viewModel()!,
    error: () => this.loadError(),
    isLoading: () => this.loading(),
    reload: () => {
      void this.loadCurrent(true);
    },
  };

  readonly period = computed<PeriodInfo>(() => {
    const raw = this.rawData();
    const granularity = this.granularity();
    if (raw) {
      return buildFoodcostPeriodInfo(
        raw,
        granularity,
        this.periodService.periodNote(granularity),
      );
    }
    if (this.loadError()) return ERROR;
    if (this.loading()) return LOADING;
    return LOADING;
  });

  readonly viewModel = computed(() => {
    const raw = this.rawData();
    if (!raw) return null;
    return buildFoodcostViewModel(raw, { granularity: this.granularity() });
  });

  constructor() {
    this.sync.register('foodcost', this.data);

    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId) {
        untracked(() => this.resetState());
        return;
      }

      const granularity = this.granularity();
      const chartPeriod = this.periodService.chartPeriod();
      const anchorPeriod = this.resolveAnchorPeriod();

      untracked(() => {
        void this.loadCurrent(false, granularity, chartPeriod, anchorPeriod);
      });
    });
  }

  private resolveAnchorPeriod(): FoodcostApi['period'] | null {
    return this.periodService.dashboardPeriod() ?? this.rawData()?.period ?? null;
  }

  private tenantScope(): string {
    return analyticsTenantScope(this.auth.user()?.id);
  }

  private currentCacheKey(
    granularity = this.granularity(),
    chartPeriod = this.periodService.chartPeriod(),
    anchorPeriod = this.resolveAnchorPeriod(),
  ): string {
    const query = resolveFoodcostQuery(granularity, chartPeriod, anchorPeriod);
    return buildDashboardCacheKey(this.tenantScope(), query);
  }

  private async loadCurrent(
    force: boolean,
    granularity = this.granularity(),
    chartPeriod = this.periodService.chartPeriod(),
    anchorPeriod = this.resolveAnchorPeriod(),
  ): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;

    const key = this.currentCacheKey(granularity, chartPeriod, anchorPeriod);
    if (!force && this.cache.isFresh(key, this.cacheConfig.staleAfterMs) && this.rawData()) {
      const cached = this.cache.peek(key);
      if (cached) {
        this.rawData.set(cached.data);
      }
      return;
    }

    const requestId = ++this.latestRequestId;
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const query = resolveFoodcostQuery(granularity, chartPeriod, anchorPeriod);
      const hit = await this.cache.getOrLoad(
        key,
        (etag) => firstValueFrom(this.repository.fetch(query, { etag })),
        force ? 0 : this.cacheConfig.staleAfterMs,
      );
      if (requestId !== this.latestRequestId) return;
      this.rawData.set(hit.data);
    } catch (error) {
      if (requestId !== this.latestRequestId) return;
      this.loadError.set(error);
    } finally {
      if (requestId === this.latestRequestId) {
        this.loading.set(false);
      }
    }
  }

  private resetState(): void {
    this.latestRequestId += 1;
    this.rawData.set(null);
    this.loadError.set(null);
    this.loading.set(false);
    this.cache.clearAll();
  }
}

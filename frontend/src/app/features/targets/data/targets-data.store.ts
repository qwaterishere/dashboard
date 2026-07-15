import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { PeriodService } from '../../../core/services/period.service';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { TargetsRepository } from '../../../core/data/targets.repository';
import { DashboardCache } from '../../../core/data/dashboard-cache.service';
import { DashboardCompareCache } from '../../../core/data/dashboard-compare-cache.service';
import { FoodcostCache } from '../../../core/data/foodcost-cache.service';
import type { TargetsData, TargetsUpsertRequest } from '../../../shared/models/targets.model';

export interface TargetsResourceFacade {
  hasValue(): boolean;
  value(): TargetsData;
  error(): unknown | null;
  isLoading(): boolean;
  reload(): void;
}

@Injectable({ providedIn: 'root' })
export class TargetsDataStore {
  private readonly auth = inject(AuthService);
  private readonly periodService = inject(PeriodService);
  private readonly repository = inject(TargetsRepository);
  private readonly sync = inject(AnalyticsDataSyncService);
  private readonly dashboardCache = inject(DashboardCache);
  private readonly compareCache = inject(DashboardCompareCache);
  private readonly foodcostCache = inject(FoodcostCache);

  private readonly rawData = signal<TargetsData | null>(null);
  private readonly loadError = signal<unknown | null>(null);
  private readonly loading = signal(false);
  private latestRequestId = 0;

  readonly data: TargetsResourceFacade = {
    hasValue: () => this.rawData() !== null,
    value: () => this.rawData()!,
    error: () => this.loadError(),
    isLoading: () => this.loading(),
    reload: () => {
      void this.loadCurrent();
    },
  };

  readonly periodLabel = computed(() => this.rawData()?.period.label ?? '…');

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId) {
        untracked(() => this.resetState());
        return;
      }

      const chartPeriod = this.periodService.chartPeriod();
      const dashboardPeriod = this.periodService.dashboardPeriod();
      const granularity = this.periodService.granularity();
      untracked(() => {
        void this.loadCurrent(chartPeriod, dashboardPeriod, granularity);
      });
    });
  }

  async save(payload: TargetsUpsertRequest): Promise<TargetsData> {
    const saved = await firstValueFrom(this.repository.save(payload));
    this.rawData.set(saved);
    this.loadError.set(null);
    // Планы/цели влияют на dashboard + foodcost — сбрасываем кэш и сразу refetch.
    this.dashboardCache.clearAll();
    this.compareCache.clearAll();
    this.foodcostCache.clearAll();
    this.sync.forceReload(['dashboard', 'foodcost']);
    return saved;
  }

  private resolveQuery(
    chartPeriod = this.periodService.chartPeriod(),
    dashboardPeriod = this.periodService.dashboardPeriod(),
    granularity = this.periodService.granularity(),
  ): { year?: number; month?: number } {
    // Цели всегда месячные — в year-режиме берём месяц KPI дашборда или январь.
    if (granularity === 'year') {
      const year = chartPeriod?.year ?? dashboardPeriod?.year;
      if (year == null) return {};
      if (dashboardPeriod?.year === year && dashboardPeriod.month) {
        return { year, month: dashboardPeriod.month };
      }
      return { year, month: 1 };
    }

    if (chartPeriod?.year != null && chartPeriod.month != null) {
      return { year: chartPeriod.year, month: chartPeriod.month };
    }

    if (dashboardPeriod?.year && dashboardPeriod.month) {
      return { year: dashboardPeriod.year, month: dashboardPeriod.month };
    }
    return {};
  }

  private async loadCurrent(
    chartPeriod = this.periodService.chartPeriod(),
    dashboardPeriod = this.periodService.dashboardPeriod(),
    granularity = this.periodService.granularity(),
  ): Promise<void> {
    if (!this.auth.user()?.id) return;

    const requestId = ++this.latestRequestId;
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const query = this.resolveQuery(chartPeriod, dashboardPeriod, granularity);
      const data = await firstValueFrom(this.repository.fetch(query));
      if (requestId !== this.latestRequestId) return;
      this.rawData.set(data);
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
  }
}

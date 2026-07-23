import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import { TargetsRepository } from '../../../core/data/targets.repository';
import { DashboardCache } from '../../../core/data/dashboard-cache.service';
import { DashboardCompareCache } from '../../../core/data/dashboard-compare-cache.service';
import { FoodcostCache } from '../../../core/data/foodcost-cache.service';
import type { TargetsData, TargetsUpsertRequest } from '../../../shared/models/targets.model';
import { TargetsPeriodService } from './targets-period.service';
import { formatTargetsMonthLabel } from './targets-period.utils';

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
  private readonly targetsPeriod = inject(TargetsPeriodService);
  private readonly freshness = inject(DataFreshnessService);
  private readonly repository = inject(TargetsRepository);
  private readonly sync = inject(AnalyticsDataSyncService);
  private readonly dashboardCache = inject(DashboardCache);
  private readonly compareCache = inject(DashboardCompareCache);
  private readonly foodcostCache = inject(FoodcostCache);

  private readonly rawData = signal<TargetsData | null>(null);
  private readonly loadError = signal<unknown | null>(null);
  private readonly loading = signal(false);
  /** Ключи `yyyy-mm` месяцев с заданным планом выручки. */
  readonly configuredKeys = signal<ReadonlySet<string>>(new Set());
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

  readonly periodLabel = computed(() => {
    const fromApi = this.rawData()?.period.label;
    if (fromApi) return fromApi;
    const selection = this.targetsPeriod.selection();
    if (!selection) return '…';
    return formatTargetsMonthLabel(selection.year, selection.month);
  });

  isMonthConfigured(year: number, month: number): boolean {
    return this.configuredKeys().has(monthKey(year, month));
  }

  constructor() {
    effect(() => {
      const fresh = this.freshness.freshness();
      untracked(() => {
        this.targetsPeriod.ensureBootstrapped(fresh?.latestSalesDay ?? null);
      });
    });

    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId) {
        untracked(() => this.resetState());
        return;
      }

      untracked(() => {
        void this.refreshConfiguredMonths();
      });
    });

    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId) return;

      const selection = this.targetsPeriod.selection();
      if (!selection) return;

      untracked(() => {
        void this.loadCurrent(selection.year, selection.month);
      });
    });
  }

  async save(payload: TargetsUpsertRequest): Promise<TargetsData> {
    const saved = await firstValueFrom(this.repository.save(payload));
    this.rawData.set(saved);
    this.loadError.set(null);
    this.invalidateAnalyticsCaches();
    void this.refreshConfiguredMonths();
    return saved;
  }

  async clearMonth(year: number, month: number): Promise<TargetsData> {
    const cleared = await firstValueFrom(this.repository.clear({ year, month }));
    this.rawData.set(cleared);
    this.loadError.set(null);
    this.invalidateAnalyticsCaches();
    void this.refreshConfiguredMonths();
    return cleared;
  }

  async lockMonth(year: number, month: number): Promise<TargetsData> {
    const locked = await firstValueFrom(this.repository.lock({ year, month }));
    this.rawData.set(locked);
    this.loadError.set(null);
    return locked;
  }

  async unlockMonth(year: number, month: number): Promise<TargetsData> {
    const unlocked = await firstValueFrom(this.repository.unlock({ year, month }));
    if (
      this.rawData()?.period.year === unlocked.period.year &&
      this.rawData()?.period.month === unlocked.period.month
    ) {
      this.rawData.set(unlocked);
    }
    this.loadError.set(null);
    return unlocked;
  }

  private invalidateAnalyticsCaches(): void {
    this.dashboardCache.clearAll();
    this.compareCache.clearAll();
    this.foodcostCache.clearAll();
    this.sync.forceReload(['dashboard', 'foodcost']);
  }

  private async loadCurrent(year?: number, month?: number): Promise<void> {
    if (!this.auth.user()?.id) return;

    const selection = this.targetsPeriod.selection();
    const y = year ?? selection?.year;
    const m = month ?? selection?.month;
    if (y == null || m == null) return;

    const requestId = ++this.latestRequestId;
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const data = await firstValueFrom(this.repository.fetch({ year: y, month: m }));
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

  async refreshConfiguredMonths(): Promise<void> {
    if (!this.auth.user()?.id) return;
    try {
      const list = await firstValueFrom(this.repository.listConfigured());
      this.configuredKeys.set(
        new Set(list.items.map((item) => monthKey(item.year, item.month))),
      );
    } catch {
      /* пикер просто без подсветки */
    }
  }

  private resetState(): void {
    this.latestRequestId += 1;
    this.rawData.set(null);
    this.loadError.set(null);
    this.loading.set(false);
    this.configuredKeys.set(new Set());
  }
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { AttentionRepository } from '../../../core/data/attention.repository';
import type { AttentionApi } from '../../../shared/models/attention.model';

export interface AttentionResourceFacade {
  hasValue(): boolean;
  value(): AttentionApi;
  error(): unknown | null;
  isLoading(): boolean;
  reload(): void;
}

/**
 * Лёгкий store операционного брифа. Не тянет page-stores.
 * Load on auth; SWR через AnalyticsDataSyncService; clear on logout.
 */
@Injectable({ providedIn: 'root' })
export class AttentionDataStore {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(AttentionRepository);
  private readonly sync = inject(AnalyticsDataSyncService);

  private readonly rawData = signal<AttentionApi | null>(null);
  private readonly loadError = signal<unknown | null>(null);
  private readonly loading = signal(false);
  private latestRequestId = 0;
  private registered = false;

  readonly data: AttentionResourceFacade = {
    hasValue: () => this.rawData() !== null,
    value: () => this.rawData()!,
    error: () => this.loadError(),
    isLoading: () => this.loading(),
    reload: () => {
      void this.load();
    },
  };

  /** Snapshot для VM (null пока нет успешного ответа). */
  readonly attention = this.rawData.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly hasError = () => this.loadError() !== null && this.rawData() === null;

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id;
      if (!userId) {
        untracked(() => this.resetState());
        return;
      }

      untracked(() => {
        this.ensureRegistered();
        void this.loadIfStale();
      });
    });
  }

  reload(): void {
    void this.load();
  }

  private ensureRegistered(): void {
    if (this.registered) return;
    this.registered = true;
    this.sync.register('attention', this.data);
  }

  private async loadIfStale(): Promise<void> {
    if (this.rawData() === null) {
      await this.load();
      return;
    }
    if (this.sync.isStale('attention')) {
      await this.load();
    }
  }

  private async load(): Promise<void> {
    const requestId = ++this.latestRequestId;
    this.loading.set(true);
    try {
      const payload = await firstValueFrom(this.repository.fetch());
      if (requestId !== this.latestRequestId) return;
      this.rawData.set(payload);
      this.loadError.set(null);
      this.sync.markFresh('attention');
    } catch (err) {
      if (requestId !== this.latestRequestId) return;
      this.loadError.set(err);
      // Keep stale value for SWR display when available.
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

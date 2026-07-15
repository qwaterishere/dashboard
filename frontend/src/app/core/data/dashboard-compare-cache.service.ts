import { Injectable } from '@angular/core';

import type { DashboardCompareSlice } from '../../shared/models/dashboard-api.model';
import { tenantScopeFromCacheKey } from './analytics-cache-key';

export interface DashboardCompareCacheEntry {
  data: DashboardCompareSlice;
  etag: string | null;
  fetchedAt: number;
}

export interface DashboardCompareCacheHit {
  data: DashboardCompareSlice;
  etag: string | null;
  fromCache: boolean;
}

export type DashboardCompareCacheLoaderResult =
  | { kind: 'ok'; data: DashboardCompareSlice; etag: string | null }
  | { kind: 'not-modified' };

@Injectable({ providedIn: 'root' })
export class DashboardCompareCache {
  private readonly entries = new Map<string, DashboardCompareCacheEntry>();
  private readonly inflight = new Map<string, Promise<DashboardCompareCacheHit>>();

  peek(key: string): DashboardCompareCacheEntry | undefined {
    return this.entries.get(key);
  }

  isFresh(key: string, staleAfterMs: number, now = Date.now()): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    return now - entry.fetchedAt < staleAfterMs;
  }

  clearAll(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  clearTenant(tenantScope: string): void {
    for (const key of [...this.entries.keys()]) {
      if (tenantScopeFromCacheKey(key) === tenantScope) {
        this.entries.delete(key);
        this.inflight.delete(key);
      }
    }
  }

  markTenantStale(tenantScope: string): void {
    for (const [key, entry] of this.entries) {
      if (tenantScopeFromCacheKey(key) === tenantScope) {
        entry.fetchedAt = 0;
      }
    }
  }

  async getOrLoad(
    key: string,
    loader: (etag: string | null) => Promise<DashboardCompareCacheLoaderResult>,
    staleAfterMs: number,
  ): Promise<DashboardCompareCacheHit> {
    const cached = this.entries.get(key);
    if (cached && this.isFresh(key, staleAfterMs)) {
      return { data: cached.data, etag: cached.etag, fromCache: true };
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.load(key, loader, cached);
    this.inflight.set(key, request);
    try {
      return await request;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async load(
    key: string,
    loader: (etag: string | null) => Promise<DashboardCompareCacheLoaderResult>,
    cached: DashboardCompareCacheEntry | undefined,
  ): Promise<DashboardCompareCacheHit> {
    const result = await loader(cached?.etag ?? null);

    if (result.kind === 'not-modified') {
      if (!cached) {
        const retry = await loader(null);
        if (retry.kind !== 'ok') {
          throw new Error('Compare cache miss on 304 response');
        }
        const entry: DashboardCompareCacheEntry = {
          data: retry.data,
          etag: retry.etag,
          fetchedAt: Date.now(),
        };
        this.entries.set(key, entry);
        return { data: entry.data, etag: entry.etag, fromCache: false };
      }
      cached.fetchedAt = Date.now();
      return { data: cached.data, etag: cached.etag, fromCache: true };
    }

    const entry: DashboardCompareCacheEntry = {
      data: result.data,
      etag: result.etag,
      fetchedAt: Date.now(),
    };
    this.entries.set(key, entry);
    return { data: entry.data, etag: entry.etag, fromCache: false };
  }
}

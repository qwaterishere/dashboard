import { Injectable } from '@angular/core';

import type { DashboardV2 } from '../../shared/models/dashboard-v2.model';
import { tenantScopeFromCacheKey } from './analytics-cache-key';

export interface DashboardCacheEntry {
  data: DashboardV2;
  etag: string | null;
  fetchedAt: number;
}

export interface DashboardCacheHit<T> {
  data: T;
  etag: string | null;
  fromCache: boolean;
}

export type DashboardCacheLoaderResult =
  | { kind: 'ok'; data: DashboardV2; etag: string | null }
  | { kind: 'not-modified' };

@Injectable({ providedIn: 'root' })
export class DashboardCache {
  private readonly entries = new Map<string, DashboardCacheEntry>();
  private readonly inflight = new Map<string, Promise<DashboardCacheHit<DashboardV2>>>();

  peek(key: string): DashboardCacheEntry | undefined {
    return this.entries.get(key);
  }

  getEtag(key: string): string | null {
    return this.entries.get(key)?.etag ?? null;
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

  async getOrLoad(
    key: string,
    loader: (etag: string | null) => Promise<DashboardCacheLoaderResult>,
    staleAfterMs: number,
  ): Promise<DashboardCacheHit<DashboardV2>> {
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
    loader: (etag: string | null) => Promise<DashboardCacheLoaderResult>,
    cached: DashboardCacheEntry | undefined,
  ): Promise<DashboardCacheHit<DashboardV2>> {
    const result = await loader(cached?.etag ?? null);

    if (result.kind === 'not-modified') {
      if (!cached) {
        const retry = await loader(null);
        if (retry.kind !== 'ok') {
          throw new Error('Dashboard cache miss on 304 response');
        }
        const entry: DashboardCacheEntry = {
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

    const entry: DashboardCacheEntry = {
      data: result.data,
      etag: result.etag,
      fetchedAt: Date.now(),
    };
    this.entries.set(key, entry);
    return { data: entry.data, etag: entry.etag, fromCache: false };
  }
}

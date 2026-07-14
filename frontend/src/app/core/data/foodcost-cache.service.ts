import { Injectable } from '@angular/core';

import type { FoodcostApi } from '../../shared/models/foodcost-api.model';
import { tenantScopeFromCacheKey } from './analytics-cache-key';

export interface FoodcostCacheEntry {
  data: FoodcostApi;
  etag: string | null;
  fetchedAt: number;
}

export interface FoodcostCacheHit<T> {
  data: T;
  etag: string | null;
  fromCache: boolean;
}

export type FoodcostCacheLoaderResult =
  | { kind: 'ok'; data: FoodcostApi; etag: string | null }
  | { kind: 'not-modified' };

@Injectable({ providedIn: 'root' })
export class FoodcostCache {
  private readonly entries = new Map<string, FoodcostCacheEntry>();
  private readonly inflight = new Map<string, Promise<FoodcostCacheHit<FoodcostApi>>>();

  peek(key: string): FoodcostCacheEntry | undefined {
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
    loader: (etag: string | null) => Promise<FoodcostCacheLoaderResult>,
    staleAfterMs: number,
  ): Promise<FoodcostCacheHit<FoodcostApi>> {
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
    loader: (etag: string | null) => Promise<FoodcostCacheLoaderResult>,
    cached: FoodcostCacheEntry | undefined,
  ): Promise<FoodcostCacheHit<FoodcostApi>> {
    const result = await loader(cached?.etag ?? null);

    if (result.kind === 'not-modified') {
      if (!cached) {
        const retry = await loader(null);
        if (retry.kind !== 'ok') {
          throw new Error('Foodcost cache miss on 304 response');
        }
        const entry: FoodcostCacheEntry = {
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

    const entry: FoodcostCacheEntry = {
      data: result.data,
      etag: result.etag,
      fetchedAt: Date.now(),
    };
    this.entries.set(key, entry);
    return { data: entry.data, etag: entry.etag, fromCache: false };
  }
}

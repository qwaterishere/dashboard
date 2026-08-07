import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { AttentionRepository } from '../../../core/data/attention.repository';
import type { AttentionApi } from '../../../shared/models/attention.model';
import { AttentionDataStore } from './attention-data.store';

const sample: AttentionApi = {
  asOf: '2026-07-22',
  period: { year: 2026, month: 7 },
  domains: {
    stock: 'ready',
    foodcost: 'ready',
    revenue: 'ready',
    targets: 'ready',
  },
  negativeStock: { count: 0, valueAbs: 0 },
  foodcost: null,
  revenuePace: null,
  monthPlan: { configured: true },
};

describe('AttentionDataStore', () => {
  const fetch = vi.fn(() => of(sample));
  const register = vi.fn();
  const markFresh = vi.fn();
  const isStale = vi.fn(() => false);
  const user = signal<{ id: string } | null>({ id: 'u1' });

  beforeEach(() => {
    fetch.mockClear();
    fetch.mockImplementation(() => of(sample));
    register.mockClear();
    markFresh.mockClear();
    isStale.mockReset();
    isStale.mockReturnValue(false);
    user.set({ id: 'u1' });

    TestBed.configureTestingModule({
      providers: [
        AttentionDataStore,
        { provide: AttentionRepository, useValue: { fetch } },
        {
          provide: AnalyticsDataSyncService,
          useValue: { register, markFresh, isStale },
        },
        {
          provide: AuthService,
          useValue: { user },
        },
      ],
    });
  });

  it('loads on auth and registers with sync service', async () => {
    const store = TestBed.inject(AttentionDataStore);
    await vi.waitFor(() => expect(store.attention()).toEqual(sample));
    expect(register).toHaveBeenCalledWith('attention', expect.any(Object));
    expect(markFresh).toHaveBeenCalledWith('attention');
  });

  it('clears on logout', async () => {
    const store = TestBed.inject(AttentionDataStore);
    await vi.waitFor(() => expect(store.attention()).not.toBeNull());
    user.set(null);
    await vi.waitFor(() => expect(store.attention()).toBeNull());
  });

  it('reload fetches again', async () => {
    const store = TestBed.inject(AttentionDataStore);
    await vi.waitFor(() => expect(store.data.hasValue()).toBe(true));
    fetch.mockClear();
    store.reload();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it('keeps stale value on error', async () => {
    const store = TestBed.inject(AttentionDataStore);
    await vi.waitFor(() => expect(store.attention()).not.toBeNull());
    fetch.mockReturnValueOnce(throwError(() => new Error('boom')));
    store.reload();
    await vi.waitFor(() => expect(store.isLoading()).toBe(false));
    expect(store.attention()).toEqual(sample);
  });
});

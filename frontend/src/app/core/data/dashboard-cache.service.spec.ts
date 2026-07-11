import { DashboardCache } from './dashboard-cache.service';
import type { DashboardV2 } from '../../shared/models/dashboard-v2.model';

const sample = {
  period: { year: 2026, month: 6, dayFrom: 1, dayTo: 11 },
} as DashboardV2;

describe('DashboardCache', () => {
  it('returns fresh entry without calling loader', async () => {
    const cache = new DashboardCache();
    const loader = vi.fn(async () => ({
      kind: 'ok' as const,
      data: sample,
      etag: 'W/"1"',
    }));

    await cache.getOrLoad('tenant:latest', loader, 60_000);
    const hit = await cache.getOrLoad('tenant:latest', loader, 60_000);

    expect(hit.fromCache).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('dedupes inflight requests', async () => {
    const cache = new DashboardCache();
    let resolveLoader!: (value: { kind: 'ok'; data: DashboardV2; etag: string | null }) => void;
    const loader = vi.fn(
      () =>
        new Promise<{ kind: 'ok'; data: DashboardV2; etag: string | null }>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const first = cache.getOrLoad('tenant:m:2026-6', loader, 0);
    const second = cache.getOrLoad('tenant:m:2026-6', loader, 0);
    resolveLoader({ kind: 'ok', data: sample, etag: 'W/"2"' });

    const [a, b] = await Promise.all([first, second]);
    expect(a.data).toBe(b.data);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('handles 304 with cached body', async () => {
    const cache = new DashboardCache();
    await cache.getOrLoad(
      'tenant:latest',
      async () => ({ kind: 'ok', data: sample, etag: 'W/"3"' }),
      0,
    );

    const hit = await cache.getOrLoad(
      'tenant:latest',
      async () => ({ kind: 'not-modified' }),
      0,
    );

    expect(hit.fromCache).toBe(true);
    expect(hit.data).toBe(sample);
    expect(hit.etag).toBe('W/"3"');
  });

  it('retries without etag when 304 arrives without cached body', async () => {
    const cache = new DashboardCache();
    const loader = vi
      .fn<Parameters<typeof cache.getOrLoad>[1]>()
      .mockResolvedValueOnce({ kind: 'not-modified' })
      .mockResolvedValueOnce({ kind: 'ok', data: sample, etag: 'W/"4"' });

    const hit = await cache.getOrLoad('tenant:y:2025', loader, 0);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader.mock.calls[0]?.[0]).toBeNull();
    expect(loader.mock.calls[1]?.[0]).toBeNull();
    expect(hit.data).toBe(sample);
    expect(hit.etag).toBe('W/"4"');
  });

  it('clears tenant scoped keys', async () => {
    const cache = new DashboardCache();
    await cache.getOrLoad(
      'user-a:latest',
      async () => ({ kind: 'ok', data: sample, etag: null }),
      60_000,
    );
    await cache.getOrLoad(
      'user-b:latest',
      async () => ({ kind: 'ok', data: sample, etag: null }),
      60_000,
    );

    cache.clearTenant('user-a');
    expect(cache.peek('user-a:latest')).toBeUndefined();
    expect(cache.peek('user-b:latest')).toBeDefined();
  });
});

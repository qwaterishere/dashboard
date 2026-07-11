import type { IikoSyncPublic } from '../models/iiko-settings.model';
import {
  buildSyncProgressLabel,
  buildSyncStatusText,
  clampProgressPercent,
  formatSyncDayLabel,
  resolveSyncProgressPercent,
  syncPlanDays,
} from './iiko-sync.utils';

describe('iiko-sync.utils', () => {
  const runningSync: IikoSyncPublic = {
    status: 'running',
    started_at: '2026-06-01T10:00:00Z',
    finished_at: null,
    date_from: null,
    date_to: null,
    days_loaded: null,
    plan_from: '2026-06-01',
    plan_to: '2026-06-03',
    days_done: 1,
    current_day: '2026-06-02',
    progress_percent: 50,
    error: null,
  };

  it('syncPlanDays counts inclusive range', () => {
    expect(syncPlanDays('2026-06-01', '2026-06-03')).toBe(3);
  });

  it('clampProgressPercent bounds to 0..100', () => {
    expect(clampProgressPercent(150)).toBe(100);
    expect(clampProgressPercent(-5)).toBe(0);
    expect(clampProgressPercent(null)).toBe(0);
  });

  it('resolveSyncProgressPercent uses backend percent while running', () => {
    expect(resolveSyncProgressPercent(runningSync, false)).toBe(50);
    expect(resolveSyncProgressPercent(runningSync, true)).toBe(50);
    expect(resolveSyncProgressPercent(undefined, true)).toBe(0);
  });

  it('buildSyncProgressLabel formats current day and counter', () => {
    expect(buildSyncProgressLabel(runningSync)).toContain('2 из 3 дн.');
    expect(buildSyncProgressLabel(undefined)).toBe('Подготовка загрузки…');
  });

  it('formatSyncDayLabel uses ru-RU locale', () => {
    expect(formatSyncDayLabel('2026-06-02')).toMatch(/02/);
  });

  it('buildSyncStatusText hides persisted error when requested', () => {
    const sync: IikoSyncPublic = {
      ...runningSync,
      status: 'error',
      error: 'Сбой iiko',
    };
    expect(buildSyncStatusText(sync)).toBe('Сбой iiko');
    expect(buildSyncStatusText(sync, { hidePersistedError: true })).toBe('');
  });
});

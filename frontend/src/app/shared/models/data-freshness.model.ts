/** Статус актуальности продаж — GET /api/data-freshness */

export type DataFreshnessStatus =
  | 'fresh'
  | 'stale'
  | 'stale_manual'
  | 'syncing'
  | 'error'
  | 'empty'
  | 'unconfigured';

export type SyncStatus = 'idle' | 'running' | 'success' | 'error' | 'noop';

export interface DataFreshness {
  status: DataFreshnessStatus;
  expectedDay: string;
  latestSalesDay: string | null;
  lagDays: number | null;
  lastSyncAt: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  autoSyncEnabled: boolean;
  syncProgressPercent: number | null;
}

/** Статус актуальности продаж и склада — GET /api/data-freshness */

export type DataFreshnessStatus =
  | 'fresh'
  | 'stale'
  | 'stale_manual'
  | 'syncing'
  | 'error'
  | 'empty'
  | 'unconfigured';

export type SyncStatus = 'idle' | 'running' | 'success' | 'error' | 'noop';
export type SyncPhase = 'sales' | 'stock';
export type StockDomainStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

export interface StockFreshness {
  latestDay: string | null;
  lagDays: number | null;
  syncStatus: StockDomainStatus;
  syncError: string | null;
  daysDone: number | null;
}

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
  syncPhase: SyncPhase | null;
  stock: StockFreshness;
}

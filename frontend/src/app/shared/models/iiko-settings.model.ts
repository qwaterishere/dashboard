/** Настройки подключения iiko — GET/PUT /api/integrations/iiko */

export type IikoSyncStatus = 'idle' | 'running' | 'success' | 'error' | 'noop';
export type IikoSyncPhase = 'sales' | 'stock';
export type StockDomainStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

export interface StockSyncPublic {
  status: StockDomainStatus;
  latest_day: string | null;
  lag_days: number | null;
  days_done: number | null;
  error: string | null;
}

export interface IikoSyncPublic {
  status: IikoSyncStatus;
  started_at: string | null;
  finished_at: string | null;
  date_from: string | null;
  date_to: string | null;
  days_loaded: number | null;
  plan_from: string | null;
  plan_to: string | null;
  days_done: number | null;
  current_day: string | null;
  progress_percent: number | null;
  phase: IikoSyncPhase | null;
  error: string | null;
  stock: StockSyncPublic;
}

export interface IikoSettingsPublic {
  restaurant_id: string;
  configured: boolean;
  iiko_url: string | null;
  iiko_login: string | null;
  updated_at: string | null;
  sync: IikoSyncPublic;
}

export interface UpdateIikoSettingsRequest {
  iiko_url: string;
  iiko_login: string;
  /** Пустой — оставить сохранённый пароль при обновлении URL/логина */
  iiko_password: string;
}

export interface IikoSyncStartResponse {
  status: 'running';
  started_at: string;
}

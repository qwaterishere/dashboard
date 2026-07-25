import type { IikoSyncPublic } from '../models/iiko-settings.model';

export function syncPlanDays(planFrom: string | null, planTo: string | null): number | null {
  if (!planFrom || !planTo) return null;
  const start = new Date(`${planFrom}T00:00:00`);
  const end = new Date(`${planTo}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function clampProgressPercent(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function formatSyncDayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('ru-RU');
}

export function resolveSyncProgressPercent(
  sync: IikoSyncPublic | undefined,
  syncLoading: boolean,
): number {
  if (!sync || sync.status !== 'running') {
    return syncLoading ? 0 : 0;
  }
  return clampProgressPercent(sync.progress_percent);
}

export function buildSyncProgressLabel(sync: IikoSyncPublic | undefined): string {
  if (!sync || sync.status !== 'running') {
    return 'Подготовка загрузки…';
  }

  const dayLabel = sync.current_day ? formatSyncDayLabel(sync.current_day) : '…';
  const total = syncPlanDays(sync.plan_from, sync.plan_to);
  const domain = sync.phase === 'stock' ? 'склад' : 'продажи';

  if (total !== null) {
    const currentNum = Math.min((sync.days_done ?? 0) + (sync.phase === 'stock' ? 0 : 1), total);
    const done = sync.phase === 'stock' ? (sync.days_done ?? 0) : currentNum;
    const shown = sync.phase === 'stock' ? Math.min(Math.max(done, 1), total) : currentNum;
    return `Скачивается ${domain} за ${dayLabel} · ${shown} из ${total} дн.`;
  }

  return `Скачивается ${domain} за ${dayLabel}`;
}

export function buildSyncStatusText(
  sync: IikoSyncPublic | undefined,
  options?: { hidePersistedError?: boolean },
): string {
  if (!sync) return '';

  if (sync.status === 'success' && sync.date_from && sync.date_to) {
    const days = sync.days_loaded ?? 0;
    const stockNote =
      sync.stock?.latest_day != null
        ? ` · склад до ${sync.stock.latest_day}`
        : '';
    return `Последняя загрузка: ${sync.date_from} — ${sync.date_to} (${days} дн.)${stockNote}`;
  }
  if (sync.status === 'noop') {
    return 'Данные актуальны — новых дней для загрузки нет.';
  }
  if (sync.status === 'error') {
    if (options?.hidePersistedError) return '';
    return sync.error ?? sync.stock?.error ?? 'Ошибка загрузки данных';
  }
  return 'Загрузите продажи и склад из iiko для отображения дашборда.';
}

import type { DataFreshness, DataFreshnessStatus } from '../../shared/models/data-freshness.model';

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

export function formatSalesDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return DATE_FMT.format(new Date(year, month - 1, day));
}

export function formatSalesDayShort(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return SHORT_DATE_FMT.format(new Date(year, month - 1, day)).replace(/\.$/, '');
}

export function lagLabel(lagDays: number): string {
  const mod10 = lagDays % 10;
  const mod100 = lagDays % 100;
  if (mod10 === 1 && mod100 !== 11) return `${lagDays} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${lagDays} дня`;
  }
  return `${lagDays} дней`;
}

/** Отставание ≥ порога — critical (красная точка + banner). */
export const SEVERE_FRESHNESS_LAG_DAYS = 3;

/** Цвет точки — только актуальность данных (lag). */
export type FreshnessDotTone = 'ok' | 'warn' | 'critical';

/** Сuffix — состояние sync job. */
export type FreshnessJobSuffix = 'sync' | 'action' | null;

/** Urgency для banner (D): только action_required и critical. */
export type FreshnessUrgency = 'ok' | 'pending' | 'action_required' | 'critical';

export interface FreshnessBannerView {
  visible: boolean;
  tone: 'warn' | 'error';
  message: string;
  showSettingsLink: boolean;
}

export interface FreshnessBadgeView {
  dotTone: FreshnessDotTone;
  label: string;
  title: string;
  jobSuffix: FreshnessJobSuffix;
  pulsing: boolean;
}

function latestDayTitle(freshness: DataFreshness): string {
  if (!freshness.latestSalesDay) {
    return '';
  }
  return `Последний день в базе: ${formatSalesDay(freshness.latestSalesDay)}`;
}

function lagTitle(freshness: DataFreshness): string {
  if (freshness.lagDays === null || freshness.lagDays <= 0) {
    return '';
  }
  return `Отставание: ${lagLabel(freshness.lagDays)}`;
}

function jobSuffixTitle(suffix: FreshnessJobSuffix): string {
  if (suffix === 'sync') return 'Идёт синхронизация с iiko';
  if (suffix === 'action') return 'Требуется действие в настройках';
  return '';
}

export function resolveFreshnessDotTone(freshness: DataFreshness): FreshnessDotTone {
  if (freshness.status === 'unconfigured' || freshness.status === 'empty') {
    return 'warn';
  }

  const lag = freshness.lagDays ?? 0;
  if (lag >= SEVERE_FRESHNESS_LAG_DAYS) {
    return 'critical';
  }
  if (freshness.status === 'fresh' && lag === 0) {
    return 'ok';
  }
  if (lag > 0) {
    return 'warn';
  }
  return freshness.status === 'fresh' ? 'ok' : 'warn';
}

export function resolveFreshnessJobSuffix(freshness: DataFreshness): FreshnessJobSuffix {
  if (freshness.status === 'syncing' || freshness.syncStatus === 'running') {
    return 'sync';
  }
  if (
    freshness.status === 'error' ||
    freshness.status === 'stale_manual' ||
    freshness.status === 'empty' ||
    freshness.status === 'unconfigured'
  ) {
    return 'action';
  }
  return null;
}

export function resolveFreshnessUrgency(freshness: DataFreshness): FreshnessUrgency {
  const lag = freshness.lagDays ?? 0;
  if (lag >= SEVERE_FRESHNESS_LAG_DAYS) {
    return 'critical';
  }
  if (
    freshness.status === 'error' ||
    freshness.status === 'stale_manual' ||
    freshness.status === 'empty' ||
    freshness.status === 'unconfigured'
  ) {
    return 'action_required';
  }
  if (freshness.status === 'fresh') {
    return 'ok';
  }
  return 'pending';
}

function badgePrimaryLabel(freshness: DataFreshness): string {
  if (freshness.latestSalesDay) {
    return `iiko · ${formatSalesDayShort(freshness.latestSalesDay)}`;
  }
  switch (freshness.status as DataFreshnessStatus) {
    case 'unconfigured':
      return 'iiko не подключён';
    case 'empty':
      return 'iiko · нет данных';
    default:
      return 'iiko';
  }
}

function appendJobSuffix(label: string, suffix: FreshnessJobSuffix): string {
  if (suffix === 'sync') return `${label} · ↻`;
  if (suffix === 'action') return `${label} · !`;
  return label;
}

export function buildFreshnessBadge(
  freshness: DataFreshness | null,
  loadError = false,
): FreshnessBadgeView {
  if (loadError || freshness === null) {
    return {
      dotTone: 'warn',
      label: 'iiko · статус',
      title: 'Не удалось проверить синхронизацию iiko',
      jobSuffix: null,
      pulsing: false,
    };
  }

  const dotTone = resolveFreshnessDotTone(freshness);
  const jobSuffix = resolveFreshnessJobSuffix(freshness);
  const primary = badgePrimaryLabel(freshness);

  const progress =
    jobSuffix === 'sync' && freshness.syncProgressPercent !== null
      ? ` · ${freshness.syncProgressPercent}%`
      : '';

  const titleParts = [
    latestDayTitle(freshness),
    lagTitle(freshness),
    jobSuffixTitle(jobSuffix),
    freshness.syncError && jobSuffix === 'action' ? freshness.syncError : '',
  ].filter(Boolean);

  return {
    dotTone,
    label: appendJobSuffix(primary, jobSuffix),
    title: (titleParts.join(' · ') || primary) + progress,
    jobSuffix,
    pulsing: jobSuffix === 'sync',
  };
}

export function buildFreshnessBanner(freshness: DataFreshness | null): FreshnessBannerView {
  const hidden: FreshnessBannerView = {
    visible: false,
    tone: 'warn',
    message: '',
    showSettingsLink: false,
  };

  if (freshness === null) {
    return hidden;
  }

  const urgency = resolveFreshnessUrgency(freshness);
  if (urgency === 'ok' || urgency === 'pending') {
    return hidden;
  }

  if (urgency === 'critical') {
    const latest = freshness.latestSalesDay
      ? formatSalesDay(freshness.latestSalesDay)
      : 'неизвестно';
    const lag =
      freshness.lagDays !== null && freshness.lagDays > 0
        ? ` — отстают на ${lagLabel(freshness.lagDays)}`
        : '';
    return {
      visible: true,
      tone: 'error',
      message: `Данные сильно устарели (последний день ${latest}${lag}). Обновите продажи в настройках iiko.`,
      showSettingsLink: true,
    };
  }

  switch (freshness.status as DataFreshnessStatus) {
    case 'error':
      return {
        visible: true,
        tone: 'error',
        message: freshness.syncError
          ? `Не удалось обновить данные из iiko: ${freshness.syncError}`
          : 'Не удалось обновить данные из iiko.',
        showSettingsLink: true,
      };
    case 'empty':
      return {
        visible: true,
        tone: 'warn',
        message: 'Нет данных о продажах. Запустите первую синхронизацию в настройках.',
        showSettingsLink: true,
      };
    case 'unconfigured':
      return {
        visible: true,
        tone: 'warn',
        message: 'Подключите iiko в настройках, чтобы видеть актуальные данные.',
        showSettingsLink: true,
      };
    case 'stale_manual': {
      const latest = freshness.latestSalesDay
        ? formatSalesDay(freshness.latestSalesDay)
        : 'неизвестно';
      const lag =
        freshness.lagDays !== null && freshness.lagDays > 0
          ? ` — отстают на ${lagLabel(freshness.lagDays)}`
          : '';
      return {
        visible: true,
        tone: 'warn',
        message: `Данные за ${latest}${lag}. Автосинхронизация выключена — загрузите продажи вручную.`,
        showSettingsLink: true,
      };
    }
    default:
      return hidden;
  }
}

/**
 * View-model правой панели «Сейчас важно»:
 * ранжированные операционные риски из GET /api/attention
 * + компактная полоса актуальности данных (freshness).
 */

import type { AttentionApi, AttentionDomainStatus } from '../models/attention.model';
import type { DataFreshness } from '../models/data-freshness.model';
import {
  SEVERE_FRESHNESS_LAG_DAYS,
  buildFreshnessBadge,
  formatSalesDay,
  lagLabel,
  resolveFreshnessDotTone,
} from '../../core/data/data-freshness.utils';
import { formatMoney } from './money-format.utils';

export type AppStatusTone = 'ok' | 'warn' | 'critical';
export type AttentionSeverity = 'info' | 'warn' | 'critical';
export type AttentionActionKind = 'link' | 'sync' | 'none';

/** P0 = stock/fc, P1 = pace/plan/compliments, P2 = data trust. */
export type AttentionPriority = 0 | 1 | 2;

export interface AttentionItemVm {
  id: string;
  severity: AttentionSeverity;
  /** Короткая суть для карточки / колокола. */
  title: string;
  /** Числа и контекст; null если всё в title. */
  detail: string | null;
  /**
   * Плоская строка для aria / notifications (title + detail).
   * @deprecated Prefer title + detail in UI.
   */
  message: string;
  actionLabel: string | null;
  actionKind: AttentionActionKind;
  link: string | null;
  fragment: string | null;
  queryParams?: Record<string, string>;
  priority: AttentionPriority;
}

export interface TrustStripVm {
  headline: string;
  tone: AppStatusTone;
  pulsing: boolean;
  /** true — показать CTA/progress; false — одна свёрнутая строка. */
  expanded: boolean;
  compactLabel: string;
  progressPercent: number | null;
  progressLabel: string | null;
  cta: {
    kind: 'sync' | 'configure' | 'retry' | 'none';
    label: string;
    disabled: boolean;
  };
}

export interface RestaurantAttentionVm {
  loading: boolean;
  loadError: boolean;
  items: AttentionItemVm[];
  /** «N на проверку» / пусто при ok. */
  summaryLabel: string;
  attentionOkMessage: string;
  attentionOkHint: string;
  /** false пока ключевые домены грузятся — не показывать ложный «всё ок». */
  domainsReady: boolean;
  trust: TrustStripVm | null;
}

/** @deprecated Prefer AttentionApi.monthPlan — kept for legacy callers. */
export interface MonthPlanHint {
  configured: boolean | null;
}

/** @deprecated Prefer AttentionApi.negativeStock */
export interface NegativeStockHint {
  count: number;
  valueAbs: number;
}

/** @deprecated Prefer AttentionApi.foodcost */
export interface FoodcostAttentionHint {
  cleanPct: number;
  cleanGoal: number;
  cleanGoalConfigured: boolean;
  complimentsFact: number;
  complimentsGoal: number;
}

const SEV_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  warn: 1,
  info: 2,
};

const SYNC_ABS_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const REL_FMT = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

const ROLE_LABELS: Record<string, string> = {
  manager: 'Управляющий',
  accountant: 'Бухгалтер',
  warehouse: 'Склад',
};

const ATTENTION_OK_MESSAGE = 'Критичных отклонений нет';
const ATTENTION_OK_HINT = 'Можно опираться на цифры';

const DOMAIN_SETTLED: ReadonlySet<AttentionDomainStatus> = new Set([
  'ready',
  'empty',
  'insufficient',
]);

export function roleLabelFor(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? role;
}

export function formatLastSyncAt(
  iso: string | null,
  nowMs = Date.now(),
): { relative: string; absolute: string } | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const abs = SYNC_ABS_FMT.format(new Date(ts)).replace(/\.$/, '');
  const deltaSec = Math.round((ts - nowMs) / 1000);
  const absSec = Math.abs(deltaSec);
  let relative: string;
  if (absSec < 60) {
    relative = REL_FMT.format(Math.trunc(deltaSec / 1) || (deltaSec < 0 ? -1 : 0), 'second');
  } else if (absSec < 3600) {
    relative = REL_FMT.format(Math.trunc(deltaSec / 60), 'minute');
  } else if (absSec < 86400) {
    relative = REL_FMT.format(Math.trunc(deltaSec / 3600), 'hour');
  } else {
    relative = REL_FMT.format(Math.trunc(deltaSec / 86400), 'day');
  }
  return { relative, absolute: abs };
}

function syncPhaseLabel(phase: DataFreshness['syncPhase']): string {
  if (phase === 'stock') return 'Склад';
  if (phase === 'sales') return 'Продажи';
  return 'Синхронизация';
}

function formatPctRu(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

function summaryLabelFor(count: number): string {
  return `${count} на проверку`;
}

function itemMessage(title: string, detail: string | null): string {
  return detail ? `${title}: ${detail}` : title;
}

function makeItem(
  partial: Omit<AttentionItemVm, 'message'> & { detail?: string | null },
): AttentionItemVm {
  const detail = partial.detail ?? null;
  return {
    ...partial,
    detail,
    message: itemMessage(partial.title, detail),
  };
}

export function sortAttentionItems(items: AttentionItemVm[]): AttentionItemVm[] {
  return items.slice().sort((a, b) => {
    const sev = SEV_RANK[a.severity] - SEV_RANK[b.severity];
    if (sev !== 0) return sev;
    return a.priority - b.priority;
  });
}

/** Критические домены settled (ready|empty|insufficient); error/loading — нет. */
export function attentionDomainsReady(attention: AttentionApi | null): boolean {
  if (!attention) return false;
  const { stock, foodcost, revenue, targets } = attention.domains;
  return (
    DOMAIN_SETTLED.has(stock) &&
    DOMAIN_SETTLED.has(foodcost) &&
    DOMAIN_SETTLED.has(revenue) &&
    DOMAIN_SETTLED.has(targets)
  );
}

/**
 * Операционные items только из серверных flags/numbers.
 * Пороги на клиенте не пересчитываются.
 */
export function buildOperationalAttentionItemsFromApi(
  attention: AttentionApi,
): AttentionItemVm[] {
  const items: AttentionItemVm[] = [];
  const { negativeStock, foodcost, revenuePace, monthPlan } = attention;

  if (negativeStock && negativeStock.count > 0) {
    items.push(
      makeItem({
        id: 'negative-stock',
        severity: 'critical',
        title: 'Минусовые остатки',
        detail: `${negativeStock.count} поз. · дыра ${formatMoney(negativeStock.valueAbs)}`,
        actionLabel: 'К складу',
        actionKind: 'link',
        link: '/warehouse',
        fragment: null,
        queryParams: { focus: 'negative' },
        priority: 0,
      }),
    );
  }

  if (foodcost?.overGoal) {
    const goal = foodcost.cleanGoal;
    items.push(
      makeItem({
        id: 'foodcost-over',
        severity: 'critical',
        title: 'Фудкост выше цели',
        detail:
          goal != null
            ? `${formatPctRu(foodcost.cleanPct)} при цели ${formatPctRu(goal)}`
            : formatPctRu(foodcost.cleanPct),
        actionLabel: 'К фудкосту',
        actionKind: 'link',
        link: '/foodcost',
        fragment: null,
        priority: 0,
      }),
    );
  }

  if (foodcost?.complimentsOver) {
    items.push(
      makeItem({
        id: 'compliments-over',
        severity: 'warn',
        title: 'Представительские выше цели',
        detail: `${formatMoney(foodcost.complimentsFact)} при цели ${formatMoney(foodcost.complimentsGoal)}`,
        actionLabel: 'К фудкосту',
        actionKind: 'link',
        link: '/foodcost',
        fragment: null,
        priority: 1,
      }),
    );
  }

  if (revenuePace?.risk) {
    items.push(
      makeItem({
        id: 'revenue-pace',
        severity: 'warn',
        title: 'Темп выручки под риском',
        detail: 'Факт отстаёт от ожиданий на сегодня',
        actionLabel: 'К дашборду',
        actionKind: 'link',
        link: '/dashboard',
        fragment: null,
        priority: 1,
      }),
    );
  }

  if (monthPlan?.configured === false) {
    items.push(
      makeItem({
        id: 'month-plan',
        severity: 'warn',
        title: 'Нет плана на месяц',
        detail: 'Задайте план выручки',
        actionLabel: 'К целям',
        actionKind: 'link',
        link: '/targets',
        fragment: null,
        priority: 1,
      }),
    );
  }

  return items;
}

/** @deprecated Prefer buildOperationalAttentionItemsFromApi */
export function buildOperationalAttentionItems(input: {
  negativeStock: NegativeStockHint | null;
  foodcost: FoodcostAttentionHint | null;
  revenuePaceRisk: boolean | null;
  monthPlan: MonthPlanHint;
}): AttentionItemVm[] {
  const stub: AttentionApi = {
    asOf: '1970-01-01',
    period: { year: 1970, month: 1 },
    domains: {
      stock: 'ready',
      foodcost: 'ready',
      revenue: 'ready',
      targets: 'ready',
    },
    negativeStock: input.negativeStock,
    foodcost: input.foodcost
      ? {
          cleanPct: input.foodcost.cleanPct,
          cleanGoal: input.foodcost.cleanGoal,
          cleanGoalConfigured: input.foodcost.cleanGoalConfigured,
          overGoal:
            input.foodcost.cleanGoalConfigured &&
            input.foodcost.cleanGoal > 0 &&
            input.foodcost.cleanPct > input.foodcost.cleanGoal,
          complimentsFact: input.foodcost.complimentsFact,
          complimentsGoal: input.foodcost.complimentsGoal,
          complimentsOver:
            input.foodcost.complimentsGoal > 0 &&
            input.foodcost.complimentsFact > input.foodcost.complimentsGoal,
        }
      : null,
    revenuePace:
      input.revenuePaceRisk === null
        ? null
        : { risk: input.revenuePaceRisk, fact: 0, pace: null },
    monthPlan:
      input.monthPlan.configured === null
        ? null
        : { configured: input.monthPlan.configured },
  };
  return buildOperationalAttentionItemsFromApi(stub);
}

/** P2 freshness items — только для trust/legacy; не в ranked list VM. */
export function buildFreshnessAttentionItems(
  freshness: DataFreshness,
): AttentionItemVm[] {
  const items: AttentionItemVm[] = [];

  if (freshness.status === 'unconfigured') {
    items.push(
      makeItem({
        id: 'unconfigured',
        severity: 'warn',
        title: 'iiko не подключён',
        detail: 'Нужен для продаж и склада',
        actionLabel: 'В настройки',
        actionKind: 'link',
        link: '/settings',
        fragment: 'iiko-sync',
        priority: 2,
      }),
    );
    return items;
  }

  if (freshness.status === 'empty') {
    items.push(
      makeItem({
        id: 'empty',
        severity: 'warn',
        title: 'Нет продаж в базе',
        detail: 'Запустите первую синхронизацию',
        actionLabel: 'Обновить',
        actionKind: 'sync',
        link: null,
        fragment: null,
        priority: 2,
      }),
    );
  }

  if (freshness.status === 'error' || freshness.stock.syncStatus === 'error') {
    const detail =
      freshness.syncError ||
      freshness.stock.syncError ||
      'Не удалось обновить данные из iiko';
    items.push(
      makeItem({
        id: 'sync-error',
        severity: 'critical',
        title: 'Ошибка синхронизации',
        detail,
        actionLabel: 'В настройки',
        actionKind: 'link',
        link: '/settings',
        fragment: 'iiko-sync',
        priority: 2,
      }),
    );
  }

  if (freshness.lagDays !== null && freshness.lagDays > 0) {
    const severe = freshness.lagDays >= SEVERE_FRESHNESS_LAG_DAYS;
    items.push(
      makeItem({
        id: 'sales-lag',
        severity: severe ? 'critical' : 'warn',
        title: 'Продажи отстают',
        detail: lagLabel(freshness.lagDays),
        actionLabel: 'Обновить',
        actionKind: 'sync',
        link: null,
        fragment: null,
        priority: 2,
      }),
    );
  }

  if (freshness.stock.lagDays !== null && freshness.stock.lagDays > 0) {
    const severe = freshness.stock.lagDays >= SEVERE_FRESHNESS_LAG_DAYS;
    items.push(
      makeItem({
        id: 'stock-lag',
        severity: severe ? 'critical' : 'warn',
        title: 'Склад отстаёт',
        detail: lagLabel(freshness.stock.lagDays),
        actionLabel: 'Обновить',
        actionKind: 'sync',
        link: null,
        fragment: null,
        priority: 2,
      }),
    );
  }

  const staleLike =
    freshness.status === 'stale' ||
    freshness.status === 'stale_manual' ||
    (freshness.lagDays !== null && freshness.lagDays > 0) ||
    (freshness.stock.lagDays !== null && freshness.stock.lagDays > 0);

  if (!freshness.autoSyncEnabled && staleLike && freshness.status !== 'empty') {
    items.push(
      makeItem({
        id: 'autosync-off',
        severity: 'info',
        title: 'Автообновление выключено',
        detail: 'Данные обновляются вручную',
        actionLabel: 'В настройки',
        actionKind: 'link',
        link: '/settings',
        fragment: 'iiko-sync',
        priority: 2,
      }),
    );
  }

  return items;
}

function trustNeedsAttention(freshness: DataFreshness): boolean {
  if (freshness.status === 'unconfigured') return true;
  if (freshness.status === 'empty') return true;
  if (freshness.status === 'error' || freshness.stock.syncStatus === 'error') return true;
  if (freshness.status === 'syncing' || freshness.syncStatus === 'running') return true;
  if (freshness.lagDays !== null && freshness.lagDays > 0) return true;
  if (freshness.stock.lagDays !== null && freshness.stock.lagDays > 0) return true;
  if (
    !freshness.autoSyncEnabled &&
    (freshness.status === 'stale' || freshness.status === 'stale_manual')
  ) {
    return true;
  }
  return resolveFreshnessDotTone(freshness) !== 'ok';
}

function buildTrustStrip(
  freshness: DataFreshness,
  nowMs: number,
  syncBusy: boolean,
): TrustStripVm {
  const badge = buildFreshnessBadge(freshness);
  const tone = resolveFreshnessDotTone(freshness) as AppStatusTone;
  const syncing =
    syncBusy ||
    freshness.status === 'syncing' ||
    freshness.syncStatus === 'running';
  const expanded = trustNeedsAttention(freshness) || syncing;
  const dayLabel = formatSalesDay(freshness.expectedDay);
  const lastSync = formatLastSyncAt(freshness.lastSyncAt, nowMs);

  let headline: string;
  if (syncing) headline = 'Идёт синхронизация';
  else if (freshness.status === 'unconfigured') headline = 'iiko не подключён';
  else if (freshness.status === 'empty') headline = 'Нет данных';
  else if (freshness.status === 'error') headline = 'Ошибка синхронизации';
  else if (tone === 'ok') headline = 'Данные актуальны';
  else if (tone === 'critical') headline = 'Данные сильно устарели';
  else headline = 'Данные отстают';

  const compactLabel =
    tone === 'ok' && !syncing
      ? `Актуально на ${dayLabel}`
      : lastSync
        ? `${headline} · обновлено ${lastSync.relative}`
        : headline;

  let cta: TrustStripVm['cta'];
  if (freshness.status === 'unconfigured') {
    cta = { kind: 'configure', label: 'Подключить iiko', disabled: false };
  } else if (syncing) {
    cta = { kind: 'sync', label: 'Обновление…', disabled: true };
  } else {
    cta = { kind: 'sync', label: 'Обновить', disabled: false };
  }

  return {
    headline,
    tone,
    pulsing: badge.pulsing || syncing,
    expanded,
    compactLabel,
    progressPercent: syncing ? freshness.syncProgressPercent : null,
    progressLabel: syncing ? syncPhaseLabel(freshness.syncPhase) : null,
    cta,
  };
}

export function buildRestaurantAttentionVm(input: {
  attention: AttentionApi | null;
  attentionLoading?: boolean;
  attentionLoadError?: boolean;
  freshness: DataFreshness | null;
  freshnessLoading: boolean;
  freshnessLoadError: boolean;
  syncBusy?: boolean;
  nowMs?: number;
  /** @deprecated Use attention API */
  negativeStock?: NegativeStockHint | null;
  /** @deprecated Use attention API */
  foodcost?: FoodcostAttentionHint | null;
  /** @deprecated Use attention API */
  revenuePaceRisk?: boolean | null;
  /** @deprecated Use attention API */
  monthPlan?: MonthPlanHint;
  /** @deprecated Derived from attention domains */
  domainsPending?: boolean;
}): RestaurantAttentionVm {
  const {
    attention,
    attentionLoading = false,
    attentionLoadError = false,
    freshness,
    freshnessLoading,
    freshnessLoadError,
    syncBusy = false,
    nowMs = Date.now(),
  } = input;

  const attentionOkMessage = ATTENTION_OK_MESSAGE;
  const attentionOkHint = ATTENTION_OK_HINT;
  const domainsReady = attentionDomainsReady(attention);
  const attentionPending = attentionLoading && attention === null;

  if ((freshnessLoading && freshness === null) || attentionPending) {
    return {
      loading: true,
      loadError: false,
      items: [],
      summaryLabel: '',
      attentionOkMessage,
      attentionOkHint,
      domainsReady: false,
      trust: null,
    };
  }

  if (freshnessLoadError && freshness === null) {
    return {
      loading: false,
      loadError: true,
      items: [
        makeItem({
          id: 'load-error',
          severity: 'warn',
          title: 'Статус данных неизвестен',
          detail: 'Не удалось проверить актуальность',
          actionLabel: 'Повторить',
          actionKind: 'none',
          link: null,
          fragment: null,
          priority: 2,
        }),
      ],
      summaryLabel: summaryLabelFor(1),
      attentionOkMessage,
      attentionOkHint,
      domainsReady: false,
      trust: {
        headline: 'Статус неизвестен',
        tone: 'warn',
        pulsing: false,
        expanded: true,
        compactLabel: 'Статус неизвестен',
        progressPercent: null,
        progressLabel: null,
        cta: { kind: 'retry', label: 'Повторить', disabled: false },
      },
    };
  }

  if (attentionLoadError && attention === null) {
    return {
      loading: false,
      loadError: true,
      items: [
        makeItem({
          id: 'attention-load-error',
          severity: 'warn',
          title: 'Не удалось загрузить бриф',
          detail: 'Повторите попытку',
          actionLabel: 'Повторить',
          actionKind: 'none',
          link: null,
          fragment: null,
          priority: 2,
        }),
      ],
      summaryLabel: summaryLabelFor(1),
      attentionOkMessage,
      attentionOkHint,
      domainsReady: false,
      trust: freshness ? buildTrustStrip(freshness, nowMs, syncBusy) : null,
    };
  }

  // Operational list = API only (freshness trust-only — дедуп P2).
  const operational = attention ? buildOperationalAttentionItemsFromApi(attention) : [];
  const items = sortAttentionItems(operational);
  const n = items.length;
  const summaryLabel = n > 0 ? summaryLabelFor(n) : '';

  return {
    loading: freshnessLoading || (attentionLoading && !attention),
    loadError: false,
    items,
    summaryLabel,
    attentionOkMessage,
    attentionOkHint,
    domainsReady,
    trust: freshness ? buildTrustStrip(freshness, nowMs, syncBusy) : null,
  };
}

/** @deprecated Use buildRestaurantAttentionVm */
export function buildAppStatusVm(input: {
  freshness: DataFreshness | null;
  loading: boolean;
  loadError: boolean;
  role?: string | null;
  monthPlan?: MonthPlanHint;
  nowMs?: number;
}): RestaurantAttentionVm {
  return buildRestaurantAttentionVm({
    attention: {
      asOf: '1970-01-01',
      period: { year: 1970, month: 1 },
      domains: {
        stock: 'ready',
        foodcost: 'ready',
        revenue: 'ready',
        targets: 'ready',
      },
      negativeStock: { count: 0, valueAbs: 0 },
      foodcost: null,
      revenuePace: { risk: false, fact: 0, pace: null },
      monthPlan: input.monthPlan?.configured != null
        ? { configured: input.monthPlan.configured }
        : { configured: true },
    },
    freshness: input.freshness,
    freshnessLoading: input.loading,
    freshnessLoadError: input.loadError,
    nowMs: input.nowMs,
  });
}

/** @deprecated Use buildFreshnessAttentionItems / buildOperationalAttentionItemsFromApi */
export function buildAttentionItems(freshness: DataFreshness): AttentionItemVm[] {
  return buildFreshnessAttentionItems(freshness);
}

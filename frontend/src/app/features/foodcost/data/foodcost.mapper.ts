import { CAT_NAME } from '../../../shared/constants/category.constants';
import type { CategoryKey, LflDirection, LflMetric, PeriodGranularity } from '../../../shared/models/common.model';
import type { FoodcostData } from '../../../shared/models/foodcost.model';
import type { DashboardData } from '../../../shared/models/dashboard.model';
import type {
  BaseCost,
  FoodcostApi,
  GroupCost,
  ProductCost,
  UnitCost,
} from '../../../shared/models/foodcost-api.model';
import {
  buildPeriodInfo,
  formatPeriodRange,
  formatYearPeriodLabel,
} from '../../../shared/utils/period-format.utils';

const KBW: CategoryKey[] = ['k', 'b', 'w'];

export interface FoodcostViewModelOptions {
  granularity?: PeriodGranularity;
}

function fcPct(cost: number, revenueWithCost: number): number {
  return revenueWithCost > 0 ? (cost / revenueWithCost) * 100 : 0;
}

function prevFcPct(facts: BaseCost): number | null {
  if (facts.prevCost === null || facts.prevRevenueWithCost === null) {
    return null;
  }
  return fcPct(facts.prevCost, facts.prevRevenueWithCost);
}

function fcLfl(currentPct: number, prevPct: number | null): LflMetric {
  if (prevPct === null || prevPct === 0) {
    return { pct: 0, dir: 'up' };
  }
  const pct = ((currentPct - prevPct) / prevPct) * 100;
  return { pct, dir: (pct >= 0 ? 'up' : 'dn') as LflDirection };
}

function resolveGoal(explicit: number | null, fallbackPrevPct: number | null): number {
  if (explicit !== null) return explicit;
  return fallbackPrevPct ?? 0;
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} %`;
}

function formatSignedPct(value: number): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
}

function buildOverviewClean(totals: FoodcostApi['totals']): FoodcostData['overview']['clean'] {
  const pct = fcPct(totals.cost, totals.revenueWithCost);
  const prevPct = prevFcPct(totals);
  return {
    title: 'Чистый фудкост',
    tag: 'продажи',
    subtitle: 'себестоимость проданного / выручка с техкартами',
    pct,
    lfl: fcLfl(pct, prevPct),
    goal: resolveGoal(totals.goal, prevPct),
    cost: totals.cost,
    revenue: totals.revenue,
  };
}

/** Сумма потерь в себестоимости (комплименты + стафф; writeoffs — фаза 2). */
function lossCostTotal(losses: FoodcostApi['losses']): number {
  return losses.compliments.cost + losses.staff.cost;
}

/**
 * Грязный фудкост: чистый cost + потери.
 * Знаменатель тот же (revenueWithCost). LfL по prev* без истории потерь —
 * приближение до фазы 2 API.
 */
function buildOverviewDirty(
  totals: FoodcostApi['totals'],
  losses: FoodcostApi['losses'],
): FoodcostData['overview']['dirty'] {
  const overSales = lossCostTotal(losses);
  const dirtyCost = totals.cost + overSales;
  const pct = fcPct(dirtyCost, totals.revenueWithCost);
  const prevPct = prevFcPct(totals);
  const writeoffsPending = losses.writeoffs === null;

  return {
    title: 'Фудкост с учётом потерь',
    tag: 'потери',
    subtitle: writeoffsPending
      ? 'чистый + стафф + представительские · списания появятся позже'
      : 'себестоимость продаж и потери / выручка с техкартами',
    pct,
    lfl: fcLfl(pct, prevPct),
    goal: resolveGoal(totals.goal, prevPct),
    cost: dirtyCost,
    overSales,
  };
}

function buildUnits(units: UnitCost[]): FoodcostData['units'] {
  const kbwUnits = units.filter((unit) => KBW.includes(unit.key as CategoryKey));
  const totalCost = kbwUnits.reduce((sum, unit) => sum + unit.cost, 0);

  return kbwUnits.map((unit) => {
    const pct = fcPct(unit.cost, unit.revenueWithCost);
    const prevPct = prevFcPct(unit);
    return {
      key: unit.key as CategoryKey,
      name: CAT_NAME[unit.key as CategoryKey],
      pct,
      lfl: fcLfl(pct, prevPct),
      goal: resolveGoal(unit.goal ?? null, prevPct),
      cost: unit.cost,
      shareOfSpend: totalCost > 0 ? (unit.cost / totalCost) * 100 : 0,
    };
  });
}

function buildCategories(groups: GroupCost[]): FoodcostData['categories'] {
  const byUnit: FoodcostData['categories'] = { k: [], b: [], w: [], o: [] };

  for (const group of groups) {
    if (!KBW.includes(group.unit as CategoryKey)) continue;
    const pct = fcPct(group.cost, group.revenueWithCost);
    const prevPct = prevFcPct(group);
    byUnit[group.unit as CategoryKey].push({
      name: group.group,
      fact: pct,
      goal: resolveGoal(group.goal ?? null, prevPct),
      cost: group.cost,
    });
  }

  return byUnit;
}

function buildLosses(losses: FoodcostApi['losses']): FoodcostData['losses'] {
  const rows: FoodcostData['losses']['rows'] = [
    {
      name: 'Списания',
      note: losses.writeoffs === null ? 'данные появятся после подключения OLAP' : 'порча, бой, истёкший срок',
      fact: 0,
      goal: losses.writeoffsGoal ?? 0,
    },
    {
      name: 'Стафф-питание',
      note: 'бесплатное питание персонала',
      fact: losses.staff.cost,
      goal: 0,
    },
    {
      name: 'Представительские',
      note: 'угощения за счёт заведения',
      fact: losses.compliments.cost,
      goal: losses.complimentsGoal ?? 0,
    },
  ];

  const fact = rows.reduce((sum, row) => sum + row.fact, 0);
  const goal = rows.reduce((sum, row) => sum + row.goal, 0);
  return {
    rows,
    total: { fact, goal },
  };
}

function buildDiscounts(data: FoodcostApi): FoodcostData['discounts'] {
  const { totals, discounts } = data;
  const regularFc = fcPct(totals.cost, totals.revenueWithCost);
  const discountedFc =
    discounts.discountedRevenueWithCost > 0
      ? fcPct(discounts.discountedCost, discounts.discountedRevenueWithCost)
      : 0;
  const impact =
    totals.revenueWithCost + discounts.discountSumWithCost > 0
      ? regularFc -
        (totals.cost / (totals.revenueWithCost + discounts.discountSumWithCost)) * 100
      : 0;

  return [
    {
      label: 'Сумма скидок',
      value: formatMoney(discounts.discountSum),
      caption: 'недополученная выручка за период',
    },
    {
      label: 'Фудкост скидочных позиций',
      value: formatPct(discountedFc),
      caption:
        regularFc > 0
          ? `против ${formatPct(regularFc)} по обычным продажам`
          : 'по строкам со скидкой и техкартой',
    },
    {
      label: 'Влияние на общий фудкост',
      value: formatSignedPct(impact),
      caption: 'за счёт снижения выручки',
      tone: 'amber',
    },
  ];
}

/** Мини-панель фудкоста на дашборде (k/b/w). */
export function buildDashboardFoodcostMini(units: UnitCost[]): DashboardData['foodcostMini'] {
  return {
    caption: 'Средняя себестоимость продаж за период',
    items: KBW.map((key) => {
      const unit = units.find((entry) => entry.key === key);
      const pct = unit ? fcPct(unit.cost, unit.revenueWithCost) : 0;
      const prevPct = unit ? prevFcPct(unit) : null;
      const goal = resolveGoal(unit?.goal ?? null, prevPct);
      const deltaPP = pct - goal;
      return {
        key,
        name: CAT_NAME[key],
        pct,
        goal,
        deltaPP,
        dir: (deltaPP >= 0 ? 'dn' : 'up') as LflDirection,
      };
    }),
  };
}

/** Доли выручки k/b/w для donut на дашборде. */
export function buildDashboardRevenueCategories(units: UnitCost[]): DashboardData['categories'] {
  const kbw = units.filter((unit) => KBW.includes(unit.key as CategoryKey) && unit.revenue > 0);
  const total = kbw.reduce((sum, unit) => sum + unit.revenue, 0);
  return kbw.map((unit) => ({
    key: unit.key as CategoryKey,
    name: CAT_NAME[unit.key as CategoryKey],
    pct: total ? Math.round((unit.revenue / total) * 100) : 0,
  }));
}

function buildProducts(products: ProductCost[]): FoodcostData['products'] {
  return products
    .filter((product) => product.qty > 0 && product.revenue > 0)
    .map((product) => ({
      id: product.id,
      name: product.name,
      group: product.unit as CategoryKey,
      price: product.revenue / product.qty,
      cost: product.cost / product.qty,
    }));
}

/** Преобразует контракт API в view-model для organism-компонентов. */
export function buildFoodcostViewModel(
  data: FoodcostApi,
  options: FoodcostViewModelOptions = {},
): FoodcostData {
  const granularity = options.granularity ?? 'month';
  const periodInfo = buildPeriodInfo(data.period, data.compare);

  return {
    period:
      granularity === 'year'
        ? {
            ...periodInfo,
            label: formatYearPeriodLabel(data.period.year, 1, data.period.month),
            compareWith: String(data.compare.year),
          }
        : periodInfo,
    overview: {
      clean: buildOverviewClean(data.totals),
      dirty: buildOverviewDirty(data.totals, data.losses),
    },
    units: buildUnits(data.units),
    losses: buildLosses(data.losses),
    discounts: buildDiscounts(data),
    categories: buildCategories(data.groups),
    products: buildProducts(data.products ?? []),
  };
}

/** Подпись периода для period bar (с учётом granularity). */
export function buildFoodcostPeriodInfo(
  data: FoodcostApi,
  granularity: PeriodGranularity,
  periodNote: string,
): FoodcostData['period'] {
  const vm = buildFoodcostViewModel(data, { granularity });
  return { ...vm.period, note: periodNote };
}

export { formatPeriodRange };

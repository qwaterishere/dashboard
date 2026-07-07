import { CAT_NAME } from '../../../shared/constants/category.constants';
import type { AbcClass } from '../../../shared/utils/abc-analysis.utils';
import type { CategoryKey, SalesPosition } from '../../../shared/models';

export type SalesStructureLevel = 'cat' | 'sub';
export type AbcAxis = 'gp' | 'rev';

export interface SalesPositionComputed {
  name: string;
  sub: string;
  cat: CategoryKey;
  qty: number;
  rev: number;
  cost: number;
  gp: number;
  fc: number;
  abc?: AbcClass;
}

export interface SalesAggregateRow {
  rev: number;
  gp: number;
  cost: number;
  qty: number;
  cat?: CategoryKey;
  sub?: string;
}

export interface SalesBarRow {
  name: string;
  rev: number;
  gp: number;
}

export interface SalesBarGroup {
  category: CategoryKey;
  title: string;
  rows: SalesBarRow[];
}

export interface DonutCategorySlice {
  key: CategoryKey;
  name: string;
  color: string;
  rev: number;
  gp: number;
}

const CATEGORY_ORDER: CategoryKey[] = ['k', 'b', 'w'];

/** Сырые метрики позиции — как legacy sales.js RAW. */
export function computeSalesRaw(positions: SalesPosition[]): SalesPositionComputed[] {
  return positions.map((p) => {
    const rev = p.qty * p.price;
    const cost = p.qty * p.unitCost;
    return {
      name: p.name,
      sub: p.sub,
      cat: p.cat,
      qty: p.qty,
      rev,
      cost,
      gp: rev - cost,
      fc: rev ? (cost / rev) * 100 : 0,
    };
  });
}

export function aggregateSalesBy(
  raw: SalesPositionComputed[],
  key: 'cat' | 'sub',
): Record<string, SalesAggregateRow> {
  const map: Record<string, SalesAggregateRow> = {};

  raw.forEach((p) => {
    const groupKey = key === 'cat' ? p.cat : `${p.cat}|${p.sub}`;
    const row = map[groupKey] ?? {
      rev: 0,
      gp: 0,
      cost: 0,
      qty: 0,
      cat: p.cat,
      sub: p.sub,
    };
    row.rev += p.rev;
    row.gp += p.gp;
    row.cost += p.cost;
    row.qty += p.qty;
    map[groupKey] = row;
  });

  return map;
}

export function buildDonutSlices(
  raw: SalesPositionComputed[],
  colors: Record<CategoryKey, string>,
): DonutCategorySlice[] {
  const aggregated = aggregateSalesBy(raw, 'cat');
  return CATEGORY_ORDER.filter((key) => aggregated[key]).map((key) => ({
    key,
    name: CAT_NAME[key],
    color: colors[key],
    rev: aggregated[key].rev,
    gp: aggregated[key].gp,
  }));
}

export function buildBarGroups(
  raw: SalesPositionComputed[],
  level: SalesStructureLevel,
): SalesBarGroup[] {
  const groups: Record<CategoryKey, SalesBarRow[]> = { k: [], b: [], w: [], o: [] };

  if (level === 'cat') {
    const aggregated = aggregateSalesBy(raw, 'cat');
    CATEGORY_ORDER.forEach((cat) => {
      if (!aggregated[cat]) return;
      groups[cat].push({
        name: CAT_NAME[cat],
        rev: aggregated[cat].rev,
        gp: aggregated[cat].gp,
      });
    });
  } else {
    const map: Record<string, SalesBarRow & { cat: CategoryKey }> = {};
    raw.forEach((p) => {
      const key = `${p.cat}|${p.sub}`;
      const row = map[key] ?? { cat: p.cat, name: p.sub, rev: 0, gp: 0 };
      row.rev += p.rev;
      row.gp += p.gp;
      map[key] = row;
    });
    Object.values(map).forEach((row) => {
      groups[row.cat].push({ name: row.name, rev: row.rev, gp: row.gp });
    });
    CATEGORY_ORDER.forEach((cat) => {
      groups[cat].sort((a, b) => b.rev - a.rev);
    });
  }

  return CATEGORY_ORDER.filter((cat) => groups[cat].length > 0).map((cat) => ({
    category: cat,
    title: CAT_NAME[cat],
    rows: groups[cat],
  }));
}

export function barChartScale(groups: SalesBarGroup[]): { maxRev: number; totalRev: number } {
  const all = groups.flatMap((g) => g.rows);
  return {
    maxRev: Math.max(...all.map((row) => row.rev), 1),
    totalRev: all.reduce((sum, row) => sum + row.rev, 0),
  };
}

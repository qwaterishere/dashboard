export type AbcClass = 'A' | 'B' | 'C';

export interface AbcItem {
  abc: AbcClass;
  [key: string]: unknown;
}

export interface AbcMeta {
  abc: AbcClass;
  /** 1-based rank after sorting by axis descending. */
  rank: number;
  /** Item share of axis total, 0–100. */
  share: number;
  /** Cumulative share after this item, 0–100. */
  cumShare: number;
}

/** ABC-классификация: A ≤80%, B ≤95%, C >95% кумулятивной доли. */
export function computeAbcClasses<T extends object>(
  items: T[],
  axis: keyof T,
): (T & { abc: AbcClass })[] {
  return computeAbcWithMeta(items, axis).map((row) => {
    const { rank: _rank, share: _share, cumShare: _cumShare, ...rest } = row;
    return rest as T & { abc: AbcClass };
  });
}

/**
 * ABC + presentation meta (rank / share / cumShare).
 * Boundaries match computeAbcClasses; meta is for UI only.
 */
export function computeAbcWithMeta<T extends object>(
  items: T[],
  axis: keyof T,
): (T & AbcMeta)[] {
  const sorted = [...items].sort((a, b) => (b[axis] as number) - (a[axis] as number));
  const total = sorted.reduce((sum, item) => sum + (item[axis] as number), 0);

  if (total === 0) {
    return sorted.map((item, index) => ({
      ...item,
      abc: 'C' as AbcClass,
      rank: index + 1,
      share: 0,
      cumShare: 100,
    }));
  }

  let cum = 0;
  return sorted.map((item, index) => {
    const value = item[axis] as number;
    cum += value;
    const cumRatio = cum / total;
    const abc: AbcClass = cumRatio <= 0.8 ? 'A' : cumRatio <= 0.95 ? 'B' : 'C';
    return {
      ...item,
      abc,
      rank: index + 1,
      share: (value / total) * 100,
      cumShare: cumRatio * 100,
    };
  });
}

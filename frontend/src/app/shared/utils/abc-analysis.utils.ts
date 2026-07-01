export type AbcClass = 'A' | 'B' | 'C';

export interface AbcItem {
  abc: AbcClass;
  [key: string]: unknown;
}

/** ABC-классификация: A ≤80%, B ≤95%, C >95% кумулятивной доли. */
export function computeAbcClasses<T extends Record<string, number>>(
  items: T[],
  axis: keyof T & string,
): (T & { abc: AbcClass })[] {
  const sorted = [...items].sort((a, b) => (b[axis] as number) - (a[axis] as number));
  const total = sorted.reduce((sum, item) => sum + (item[axis] as number), 0);
  if (total === 0) {
    return sorted.map((item) => ({ ...item, abc: 'C' as AbcClass }));
  }

  let cum = 0;
  return sorted.map((item) => {
    cum += item[axis] as number;
    const share = cum / total;
    const abc: AbcClass = share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C';
    return { ...item, abc };
  });
}

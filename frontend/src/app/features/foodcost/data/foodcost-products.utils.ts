import type { CategoryKey, FoodcostProduct } from '../../../shared/models';

export type ProductChartGroup = CategoryKey | 'all';

export interface ProductChartItem {
  id: string | null;
  name: string;
  group: CategoryKey;
  price: number;
  cost: number;
  fc: number;
  margin: number;
}

export interface ProductChartBar {
  id: string | null;
  name: string;
  price: number;
  cost: number;
  fc: number;
  margin: number;
  columnHeight: number;
  costHeight: number;
  tone: 'good' | 'bad';
}

/** Метрики продукта для чарта выгодности.
 * price/cost уже за порцию; fc% = cost/price (= period cost/revenue).
 */
export function computeProductChartItems(products: FoodcostProduct[]): ProductChartItem[] {
  return products
    .filter((p) => p.price > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      group: p.group,
      price: p.price,
      cost: p.cost,
      fc: (p.cost / p.price) * 100,
      margin: p.price - p.cost,
    }));
}

export function buildProductChartBars(
  items: ProductChartItem[],
  group: ProductChartGroup,
): { good: ProductChartBar[]; bad: ProductChartBar[] } {
  const list = group === 'all' ? items : items.filter((p) => p.group === group);
  const sorted = [...list].sort((a, b) => a.fc - b.fc);
  const goodSource = sorted.slice(0, 10);
  const badSource = sorted.slice(-10).reverse();
  const maxPrice = Math.max(...goodSource.concat(badSource).map((p) => p.price), 1);

  const toBar = (p: ProductChartItem, tone: 'good' | 'bad'): ProductChartBar => {
    const columnHeight = Math.max((p.price / maxPrice) * 250, 4);
    const costHeight = p.price > 0 ? (p.cost / p.price) * columnHeight : 0;
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      cost: p.cost,
      fc: p.fc,
      margin: p.margin,
      columnHeight,
      costHeight,
      tone,
    };
  };

  return {
    good: goodSource.map((p) => toBar(p, 'good')),
    bad: badSource.map((p) => toBar(p, 'bad')),
  };
}

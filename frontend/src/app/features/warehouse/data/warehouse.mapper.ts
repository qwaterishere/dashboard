import { CAT_NAME } from '../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../shared/models';
import type {
  WarehouseApi,
  WarehouseDynamicsPoint,
  WarehouseStoreKey,
} from '../../../shared/models/warehouse-api.model';
import type {
  DynamicsSeries,
  WarehouseData,
  WarehouseTotals,
} from '../../../shared/models/warehouse.model';

const STORE_KEYS: WarehouseStoreKey[] = ['k', 'b', 'w'];
const EMPTY_SERIES: DynamicsSeries = { labels: [], values: [] };

const DATE_LONG = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});
const DATE_SHORT = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function formatAsOfLabel(iso: string): string {
  return DATE_LONG.format(parseIso(iso));
}

function formatAxisLabel(iso: string): string {
  return DATE_SHORT.format(parseIso(iso)).replace('.', '');
}

function storeSum(point: WarehouseDynamicsPoint, store: WarehouseStoreKey | 'all'): number {
  if (store === 'all') {
    return point.byStore.reduce((acc, row) => acc + row.value, 0);
  }
  return point.byStore.find((row) => row.key === store)?.value ?? 0;
}

/** Недели — все точки; месяцы — прореживание до ~8 точек. */
function samplePoints(
  points: WarehouseDynamicsPoint[],
  freq: 'week' | 'month',
): WarehouseDynamicsPoint[] {
  if (freq === 'week' || points.length <= 8) {
    return points;
  }
  const step = Math.ceil(points.length / 8);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

function buildSeries(
  points: WarehouseDynamicsPoint[],
  store: WarehouseStoreKey | 'all',
  freq: 'week' | 'month',
): DynamicsSeries {
  const sampled = samplePoints(points, freq);
  return {
    labels: sampled.map((point) => formatAxisLabel(point.date)),
    values: sampled.map((point) => storeSum(point, store)),
  };
}

function buildDynamics(
  points: WarehouseDynamicsPoint[],
): WarehouseData['dynamics'] {
  const stores: Array<WarehouseStoreKey | 'all'> = ['all', ...STORE_KEYS];
  const freqs = ['week', 'month'] as const;
  const result = {
    all: { week: EMPTY_SERIES, month: EMPTY_SERIES },
    k: { week: EMPTY_SERIES, month: EMPTY_SERIES },
    b: { week: EMPTY_SERIES, month: EMPTY_SERIES },
    w: { week: EMPTY_SERIES, month: EMPTY_SERIES },
    o: { week: EMPTY_SERIES, month: EMPTY_SERIES },
  } satisfies WarehouseData['dynamics'];

  for (const store of stores) {
    for (const freq of freqs) {
      result[store][freq] = buildSeries(points, store, freq);
    }
  }
  return result;
}

function buildTotals(totals: WarehouseApi['totals']): WarehouseTotals {
  const byStore = STORE_KEYS.map((key) => {
    const row = totals.find((item) => item.key === key);
    return {
      key: key as CategoryKey,
      name: CAT_NAME[key],
      value: row?.value ?? 0,
    };
  });
  const value = byStore.reduce((acc, row) => acc + row.value, 0);
  const stores = byStore.filter((row) => row.value > 0).length || byStore.length;
  return { value, stores, byStore };
}

/** API Warehouse → view-model для organisms. */
export function buildWarehouseViewModel(data: WarehouseApi): WarehouseData {
  return {
    asOf: {
      iso: data.asOf,
      label: formatAsOfLabel(data.asOf),
      note: 'слепок на конец дня',
    },
    dataBounds: {
      earliest: data.dataBounds.earliest,
      latest: data.dataBounds.latest,
      availableDates: data.dataBounds.availableDates,
    },
    totals: buildTotals(data.totals),
    positions: data.positions.map((row) => ({
      productId: row.productId,
      name: row.name,
      category: row.category,
      store: row.store,
      qty: row.qty,
      unit: row.unit,
      value: row.value,
    })),
    negativeStock: data.negativeStock,
    dynamics: buildDynamics(data.dynamics),
  };
}

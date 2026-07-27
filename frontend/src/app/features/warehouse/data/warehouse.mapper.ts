import { CAT_NAME } from '../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../shared/models';
import type { WarehouseApi, WarehouseStoreKey } from '../../../shared/models/warehouse-api.model';
import type { WarehouseData, WarehouseTotals } from '../../../shared/models/warehouse.model';
import { parseIsoDate } from '../../../shared/utils/iso-date.utils';

const STORE_KEYS: WarehouseStoreKey[] = ['k', 'b', 'w'];

const DATE_LONG = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

function formatAsOfLabel(iso: string): string {
  return DATE_LONG.format(parseIsoDate(iso));
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
    dynamicsPoints: data.dynamics.map((point) => ({
      date: point.date,
      byStore: point.byStore.map((row) => ({ ...row })),
    })),
  };
}

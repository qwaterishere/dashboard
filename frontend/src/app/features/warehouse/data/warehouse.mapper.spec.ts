import type { WarehouseApi } from '../../../shared/models/warehouse-api.model';
import { buildWarehouseViewModel } from './warehouse.mapper';

const sample: WarehouseApi = {
  asOf: '2026-07-14',
  dataBounds: {
    earliest: '2026-07-01',
    latest: '2026-07-14',
    availableDates: ['2026-07-01', '2026-07-14'],
  },
  totals: [
    { key: 'k', value: 100_000 },
    { key: 'b', value: 50_000 },
    { key: 'w', value: 25_000 },
  ],
  positions: [
    {
      productId: '11111111-1111-1111-1111-111111111111',
      name: 'Говядина',
      category: 'Мясо',
      store: 'k',
      qty: 10,
      unit: 'кг',
      value: 40_000,
    },
    {
      productId: '22222222-2222-2222-2222-222222222222',
      name: 'Минус-сыр',
      category: 'Молочка',
      store: 'k',
      qty: -2,
      unit: 'кг',
      value: -500,
    },
  ],
  negativeStock: { count: 1, valueAbs: 500 },
  dynamics: [
    {
      date: '2026-07-01',
      byStore: [
        { key: 'k', value: 90_000 },
        { key: 'b', value: 40_000 },
        { key: 'w', value: 20_000 },
      ],
    },
    {
      date: '2026-07-14',
      byStore: [
        { key: 'k', value: 100_000 },
        { key: 'b', value: 50_000 },
        { key: 'w', value: 25_000 },
      ],
    },
  ],
};

describe('warehouse.mapper', () => {
  it('builds totals and asOf label from API facts', () => {
    const vm = buildWarehouseViewModel(sample);
    expect(vm.totals.value).toBe(175_000);
    expect(vm.totals.byStore).toHaveLength(3);
    expect(vm.asOf.iso).toBe('2026-07-14');
    expect(vm.asOf.label).toMatch(/14/);
    expect(vm.negativeStock.count).toBe(1);
  });

  it('maps dynamics for all stores and frequencies', () => {
    const vm = buildWarehouseViewModel(sample);
    expect(vm.dynamics.all.week.values).toEqual([150_000, 175_000]);
    expect(vm.dynamics.k.week.values).toEqual([90_000, 100_000]);
    expect(vm.dynamics.all.week.labels).toHaveLength(2);
  });

  it('keeps position value from API (not qty × price)', () => {
    const vm = buildWarehouseViewModel(sample);
    expect(vm.positions[0].value).toBe(40_000);
    expect(vm.positions[0].category).toBe('Мясо');
  });
});

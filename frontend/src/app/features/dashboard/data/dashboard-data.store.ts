import { computed, effect, inject, Injectable, untracked } from '@angular/core';

import { createPageResource } from '../../../core/api/page-data.resource';
import { PeriodService } from '../../../core/services/period.service';
import type { PeriodInfo } from '../../../shared/models/common.model';
import type { DashboardV2 } from '../../../shared/models/dashboard-v2.model';
import { buildPeriodInfo, formatChartPeriodLabel } from '../../../shared/utils/period-format.utils';
import { WarehouseDataStore } from '../../warehouse/data/warehouse-data.store';
import { buildDashboardViewModel, buildStockFromWarehouse } from './dashboard-v2.utils';

const LOADING: PeriodInfo = { label: '…', note: 'загрузка' };
const ERROR: PeriodInfo = { label: '—', note: 'нет данных' };

@Injectable({ providedIn: 'root' })
export class DashboardDataStore {
  private readonly periodService = inject(PeriodService);
  private readonly warehouseStore = inject(WarehouseDataStore);

  readonly dashboard = createPageResource<DashboardV2>(() => 'dashboard');
  readonly warehouse = this.warehouseStore.data;

  readonly granularity = this.periodService.granularity;

  readonly period = computed<PeriodInfo>(() => {
    const resource = this.dashboard;
    if (resource.hasValue()) {
      const { period, compare } = resource.value();
      const base = buildPeriodInfo(period, compare);
      return { ...base, note: this.periodService.periodNote(this.granularity()) };
    }
    if (resource.error()) return ERROR;
    return LOADING;
  });

  readonly salesQuery = this.periodService.salesQuery;

  readonly viewModel = computed(() => {
    if (!this.dashboard.hasValue()) return null;

    const data = this.dashboard.value();
    const granularity = this.granularity();
    const stock = this.warehouse.hasValue()
      ? buildStockFromWarehouse(this.warehouse.value())
      : null;

    return buildDashboardViewModel(data, {
      granularity,
      stock,
      chartPeriodLabel: formatChartPeriodLabel(data.period, granularity),
    });
  });

  constructor() {
    effect(() => {
      const resource = this.dashboard;
      if (resource.hasValue()) {
        untracked(() => this.periodService.dashboardPeriod.set(resource.value().period));
      }
    });
  }
}

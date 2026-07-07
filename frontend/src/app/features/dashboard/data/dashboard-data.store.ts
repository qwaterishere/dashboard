import { computed, Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';

import type { DashboardV2 } from '../../../shared/models/dashboard-v2.model';
import { buildDashboardViewModel } from './dashboard-v2.utils';

@Injectable({ providedIn: 'root' })
export class DashboardDataStore {
  readonly dashboard = httpResource<DashboardV2>(() => ({ url: '/api/dashboard' }));

  readonly viewModel = computed(() => {
    if (!this.dashboard.hasValue()) return null;
    return buildDashboardViewModel(this.dashboard.value());
  });
}

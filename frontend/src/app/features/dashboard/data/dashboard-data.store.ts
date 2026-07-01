import { Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';

import type { DashboardData } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class DashboardDataStore {
  readonly dashboard = httpResource<DashboardData>(() => ({ url: '/api/dashboard' }));
}

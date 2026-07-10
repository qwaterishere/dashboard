import { inject, Injectable } from '@angular/core';

import { createPageResource } from '../../../core/api/page-data.resource';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import type { FoodcostData } from '../../../shared/models/foodcost.model';

@Injectable({ providedIn: 'root' })
export class FoodcostDataStore {
  private readonly sync = inject(AnalyticsDataSyncService);

  readonly data = createPageResource<FoodcostData>(() => 'foodcost');

  constructor() {
    this.sync.register('foodcost', this.data);
  }
}

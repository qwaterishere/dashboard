import { Injectable } from '@angular/core';

import { createPageResource } from '../../../core/api/page-data.resource';
import type { WarehouseData } from '../../../shared/models/warehouse.model';

/** Единый источник данных склада для dashboard и warehouse page. */
@Injectable({ providedIn: 'root' })
export class WarehouseDataStore {
  readonly data = createPageResource<WarehouseData>(() => 'warehouse');
}

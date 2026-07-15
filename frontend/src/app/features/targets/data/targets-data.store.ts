import { Injectable } from '@angular/core';

import { createPageResource } from '../../../core/api/page-data.resource';
import type { TargetsData } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class TargetsDataStore {
  readonly data = createPageResource<TargetsData>(() => 'targets');
}

import { Injectable, signal } from '@angular/core';

import type { PeriodGranularity } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class PeriodChromeService {
  readonly granularity = signal<PeriodGranularity>('month');
}

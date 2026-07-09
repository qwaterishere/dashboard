import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { DashboardDataStore } from '../../../dashboard/data/dashboard-data.store';
import type { SalesData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { computeSalesRaw } from '../../data/sales-aggregation.utils';
import { SalesStructureOrganismComponent } from '../../organisms/sales-structure/sales-structure-organism.component';
import { AbcAnalysisOrganismComponent } from '../../organisms/abc-analysis/abc-analysis-organism.component';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [LoadErrorComponent, SalesStructureOrganismComponent, AbcAnalysisOrganismComponent],
  host: { class: 'page-sales' },
  template: `
    @if (data.hasValue()) {
      <app-sales-structure-organism [positions]="positions()" />
      <app-abc-analysis-organism [positions]="positions()" />
    } @else if (data.error()) {
      <app-load-error message="Не удалось загрузить данные продаж" />
    } @else {
      <p class="loading">Загрузка…</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .loading {
      color: var(--mut2);
      font-size: 0.9rem;
    }
  `,
})
export class SalesPageComponent {
  private readonly store = inject(DashboardDataStore);
  private readonly route = inject(ActivatedRoute);

  private readonly dayQuery = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const dateFrom = params.get('date_from');
        const dateTo = params.get('date_to');
        if (dateFrom && dateTo) {
          return { dateFrom, dateTo };
        }
        return null;
      }),
    ),
    { initialValue: null },
  );

  readonly data = httpResource<SalesData>(() => {
    const dayQuery = this.dayQuery();
    if (dayQuery) {
      const params = new URLSearchParams({
        date_from: dayQuery.dateFrom,
        date_to: dayQuery.dateTo,
      });
      return { url: `/api/sales?${params.toString()}` };
    }

    const useRange = this.store.granularity() === 'week';
    const query = useRange ? this.store.salesQuery() : null;
    if (!query) {
      return { url: '/api/sales' };
    }
    const params = new URLSearchParams({
      date_from: query.dateFrom,
      date_to: query.dateTo,
    });
    return { url: `/api/sales?${params.toString()}` };
  });

  readonly positions = computed(() => {
    if (!this.data.hasValue()) return [];
    return computeSalesRaw(this.data.value().positions);
  });
}

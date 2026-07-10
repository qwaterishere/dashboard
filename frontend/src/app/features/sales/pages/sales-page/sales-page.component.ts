import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { createPageResource } from '../../../../core/api/page-data.resource';
import { PeriodService } from '../../../../core/services/period.service';
import type { SalesData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { SalesLayoutTemplateComponent } from '../../../../ui/templates/sales-layout/sales-layout-template.component';
import { computeSalesRaw } from '../../data/sales-aggregation.utils';
import { SalesStructureOrganismComponent } from '../../organisms/sales-structure/sales-structure-organism.component';
import { AbcAnalysisOrganismComponent } from '../../organisms/abc-analysis/abc-analysis-organism.component';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [
    LoadErrorComponent,
    SalesLayoutTemplateComponent,
    SalesStructureOrganismComponent,
    AbcAnalysisOrganismComponent,
  ],
  template: `
    <app-sales-layout-template>
      @if (data.hasValue()) {
        <app-sales-structure-organism [positions]="positions()" />
        <app-abc-analysis-organism [positions]="positions()" />
      } @else if (data.error()) {
        <app-load-error message="Не удалось загрузить данные продаж" />
      } @else {
        <p class="loading">Загрузка…</p>
      }
    </app-sales-layout-template>
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
  private readonly periodService = inject(PeriodService);
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

  readonly data = createPageResource<SalesData>(() => 'sales', () => {
    const dayQuery = this.dayQuery();
    if (dayQuery) {
      return {
        query: { date_from: dayQuery.dateFrom, date_to: dayQuery.dateTo },
      };
    }

    const useRange = this.periodService.granularity() === 'week';
    const query = useRange ? this.periodService.salesQuery() : null;
    if (!query) {
      return {};
    }
    return { query: { date_from: query.dateFrom, date_to: query.dateTo } };
  });

  readonly positions = computed(() => {
    if (!this.data.hasValue()) return [];
    return computeSalesRaw(this.data.value().positions);
  });
}

import { Component, computed, input, model } from '@angular/core';

import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { LegendRowComponent } from '../../../../ui/molecules/legend-row/legend-row.component';
import { DonutChartOrganismComponent } from '../../../../ui/organisms/donut-chart/donut-chart-organism.component';
import { PctIntPipe } from '../../../../shared/pipes/format.pipes';
import { CAT_COLOR } from '../../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../../shared/models';

@Component({
  selector: 'app-categories-panel-organism',
  standalone: true,
  imports: [
    PanelHeaderComponent,
    LegendRowComponent,
    DonutChartOrganismComponent,
    PctIntPipe,
  ],
  template: `
    <div class="panel panel-flat">
      <app-panel-header title="Продажи по категориям" />
      <p class="r-cap">Доля в выручке за период</p>

      @if (slices().length) {
        <div class="cat-body">
          <app-donut-chart-organism
            variant="mini"
            [slices]="slices()"
            [(highlightKey)]="highlightKey"
            [centerLabel]="centerLabel()"
            [centerValue]="centerValue()"
            ariaLabel="Доля выручки по категориям"
          />
          <div class="cat-legend">
            @for (cat of categories(); track cat.key) {
              <app-legend-row
                [name]="cat.name"
                [color]="colorOf(cat.key)"
                [class.is-dim]="highlightKey() && highlightKey() !== cat.key"
                (mouseenter)="highlightKey.set(cat.key)"
                (mouseleave)="highlightKey.set(null)"
              >
                {{ cat.pct | pctInt }}
              </app-legend-row>
            }
          </div>
        </div>
      } @else {
        <p class="cat-empty">Нет продаж за период</p>
      }
    </div>
  `,
  styleUrl: './categories-panel-organism.component.scss',
})
export class CategoriesPanelOrganismComponent {
  readonly categories = input.required<{ key: CategoryKey; name: string; pct: number }[]>();

  protected readonly highlightKey = model<string | null>(null);

  protected readonly slices = computed(() =>
    this.categories()
      .filter((cat) => cat.pct > 0)
      .map((cat) => ({
        key: cat.key,
        color: CAT_COLOR[cat.key],
        value: cat.pct,
      })),
  );

  protected readonly active = computed(() => {
    const cats = this.categories().filter((cat) => cat.pct > 0);
    if (!cats.length) return null;
    const key = this.highlightKey();
    if (key) {
      const hit = cats.find((cat) => cat.key === key);
      if (hit) return hit;
    }
    return cats.reduce((best, cat) => (cat.pct > best.pct ? cat : best));
  });

  protected readonly centerLabel = computed(() => this.active()?.name ?? '');

  protected readonly centerValue = computed(() => {
    const pct = this.active()?.pct;
    if (pct == null) return '—';
    return `${Math.round(pct)} %`;
  });

  protected colorOf(key: CategoryKey): string {
    return CAT_COLOR[key];
  }
}

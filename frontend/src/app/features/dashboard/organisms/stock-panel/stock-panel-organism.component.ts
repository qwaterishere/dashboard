import { Component, input } from '@angular/core';

import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { MoneyPipe } from '../../../../shared/pipes/format.pipes';
import { ProgressFillComponent } from '../../../../ui/atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../../../ui/atoms/progress-track/progress-track.component';
import type { CategoryKey } from '../../../../shared/models';

@Component({
  selector: 'app-stock-panel-organism',
  standalone: true,
  imports: [PanelHeaderComponent, MoneyPipe, ProgressFillComponent, ProgressTrackComponent],
  template: `
    <div class="panel panel-flat">
      <app-panel-header title="Остаток на складе" />
      @if (stock(); as s) {
        <div class="stock-total">
          <div class="st-sum">{{ s.total | money }}</div>
        </div>
        <div class="store-split">
          @for (item of s.items; track item.key) {
            <div class="ss-row">
              <span>{{ item.name }}</span>
              <b>{{ item.value | money }}</b>
            </div>
            <app-progress-track variant="bar">
              <app-progress-fill [width]="share(item.value)" [category]="item.key" />
            </app-progress-track>
          }
        </div>
      } @else {
        <p class="stock-empty">Нет слепка остатков</p>
      }
    </div>
  `,
  styleUrl: './stock-panel-organism.component.scss',
})
export class StockPanelOrganismComponent {
  readonly stock = input<{
    total: number;
    items: { key: CategoryKey; name: string; value: number }[];
  } | null>(null);

  share(value: number): number {
    const total = this.stock()?.total ?? 0;
    return total ? Math.round((value / total) * 1000) / 10 : 0;
  }
}

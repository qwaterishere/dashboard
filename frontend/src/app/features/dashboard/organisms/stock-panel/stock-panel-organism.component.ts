import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { MoneyPipe } from '../../../../shared/pipes/format.pipes';
import { ProgressFillComponent } from '../../../../ui/atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../../../ui/atoms/progress-track/progress-track.component';
import type { CategoryKey } from '../../../../shared/models';

@Component({
  selector: 'app-stock-panel-organism',
  standalone: true,
  imports: [HeadingComponent, MoneyPipe, ProgressFillComponent, ProgressTrackComponent],
  template: `
    <div class="r-block">
      <app-heading [level]="4">Остаток на складе</app-heading>
      <div class="stock-total">
        <div class="st-sum">{{ stock().total | money }}</div>
      </div>
      <div class="store-split">
        @for (item of stock().items; track item.key) {
          <div class="ss-row">
            <span>{{ item.name }}</span>
            <b>{{ item.value | money }}</b>
          </div>
          <app-progress-track variant="bar">
            <app-progress-fill [width]="share(item.value)" [category]="item.key" />
          </app-progress-track>
        }
      </div>
    </div>
  `,
  styleUrl: './stock-panel-organism.component.scss',
})
export class StockPanelOrganismComponent {
  readonly stock = input.required<{
    total: number;
    items: { key: CategoryKey; name: string; value: number }[];
  }>();

  share(value: number): number {
    const total = this.stock().total;
    return total ? Math.round((value / total) * 1000) / 10 : 0;
  }
}

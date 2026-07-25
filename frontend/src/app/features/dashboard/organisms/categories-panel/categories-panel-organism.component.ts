import { Component, input } from '@angular/core';

import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { PctIntPipe } from '../../../../shared/pipes/format.pipes';
import { ProgressFillComponent } from '../../../../ui/atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../../../ui/atoms/progress-track/progress-track.component';
import type { CategoryKey } from '../../../../shared/models';

@Component({
  selector: 'app-categories-panel-organism',
  standalone: true,
  imports: [PanelHeaderComponent, PctIntPipe, ProgressFillComponent, ProgressTrackComponent],
  template: `
    <div class="panel panel-flat">
      <app-panel-header title="Продажи по категориям" />
      <p class="r-cap">Доля в выручке за период</p>
      <div class="cat-list">
        @for (cat of categories(); track cat.key) {
          <div class="cat">
            <div class="c-top">
              <b>{{ cat.name }}</b>
              <span>{{ cat.pct | pctInt }}</span>
            </div>
            <app-progress-track variant="bar">
              <app-progress-fill [width]="cat.pct" [category]="cat.key" />
            </app-progress-track>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './categories-panel-organism.component.scss',
})
export class CategoriesPanelOrganismComponent {
  readonly categories = input.required<{ key: CategoryKey; name: string; pct: number }[]>();
}

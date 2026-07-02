import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { PctIntPipe } from '../../../../shared/pipes/format.pipes';
import { ProgressFillComponent } from '../../../../ui/atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../../../ui/atoms/progress-track/progress-track.component';
import type { CategoryKey } from '../../../../shared/models';

@Component({
  selector: 'app-categories-panel-organism',
  standalone: true,
  imports: [HeadingComponent, PctIntPipe, ProgressFillComponent, ProgressTrackComponent],
  template: `
    <div class="r-block">
      <div class="r-head">
        <div>
          <app-heading [level]="4" text="Продажи по категориям" />
          <p class="r-cap">Доля в выручке за период</p>
        </div>
      </div>
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

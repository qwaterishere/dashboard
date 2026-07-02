import { Component, input } from '@angular/core';

import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { DecimalPipe } from '../../../../shared/pipes/format.pipes';
import type { DashboardData } from '../../../../shared/models';

@Component({
  selector: 'app-reviews-panel-organism',
  standalone: true,
  imports: [PanelHeaderComponent, DecimalPipe],
  template: `
    <div class="panel panel-flat">
      <app-panel-header title="Отзывы">
        <button type="button" class="pill">Месяц</button>
      </app-panel-header>

      <div class="rev-top">
        <div class="rev-score">
          <div class="rs-num">
            {{ reviews().score | decimal }}<span>★</span>
          </div>
          <div class="rs-cap">средний балл · {{ reviews().count }} отзывов</div>
        </div>
        <div class="rev-split">
          <div class="rev-bar">
            <i class="good" [style.width.%]="reviews().split.goodPct"></i>
            <i class="mid" [style.width.%]="reviews().split.midPct"></i>
            <i class="bad" [style.width.%]="reviews().split.badPct"></i>
          </div>
          <div class="rev-legend">
            <span>
              <b class="good-t">{{ reviews().split.good }}</b> хорошие
              <span class="rl-cap">4–5★</span>
            </span>
            <span>
              <b class="mid-t">{{ reviews().split.mid }}</b> средние
              <span class="rl-cap">3★</span>
            </span>
            <span>
              <b class="bad-t">{{ reviews().split.bad }}</b> плохие
              <span class="rl-cap">1–2★</span>
            </span>
          </div>
        </div>
      </div>

      <div class="rev-src">
        @for (source of reviews().sources; track source.name) {
          <div class="src-row">
            <span class="src-name">{{ source.name }}</span>
            <span class="src-val">
              {{ source.score | decimal }}
              <span class="src-n">· {{ source.count }}</span>
            </span>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './reviews-panel-organism.component.scss',
})
export class ReviewsPanelOrganismComponent {
  readonly reviews = input.required<DashboardData['reviews']>();
}

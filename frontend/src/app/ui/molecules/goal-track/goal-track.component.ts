import { Component, input } from '@angular/core';

import { ProgressFillComponent } from '../../atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../atoms/progress-track/progress-track.component';
import { MarkLineComponent } from '../../atoms/mark-line/mark-line.component';
import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-goal-track',
  standalone: true,
  imports: [ProgressTrackComponent, ProgressFillComponent, MarkLineComponent, TextComponent],
  template: `
    <div class="k-goal">
      <div class="g-row">
        <app-text tone="muted">{{ label() }}</app-text>
        <b [class.r]="risk()">{{ headline() }}</b>
      </div>
      <app-progress-track variant="goal">
        <app-progress-fill [width]="trackPct()" [variant]="risk() ? 'risk' : 'default'" />
        <app-mark-line [position]="100" />
      </app-progress-track>
    </div>
  `,
  styles: `
    .k-goal {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #1b2236;
    }
    .g-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 0.7rem;
      color: var(--mut);
      margin-bottom: 6px;
    }
    .g-row b {
      font-size: 0.74rem;
      font-weight: 800;
      color: var(--txt);
    }
    .g-row b.r { color: var(--red); }
  `,
})
export class GoalTrackComponent {
  readonly label = input('Прогноз на конец месяца');
  readonly headline = input.required<string>();
  readonly trackPct = input.required<number>();
  readonly risk = input(false);
}

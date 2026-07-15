import { Component, input } from '@angular/core';

import { ProgressFillComponent } from '../../atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../atoms/progress-track/progress-track.component';
import { MarkLineComponent } from '../../atoms/mark-line/mark-line.component';
import { TextComponent } from '../../atoms/text/text.component';
import { PopoverTriggerDirective } from '../../directives/popover-trigger.directive';
import type { DetailPopover } from '../../../shared/models';

@Component({
  selector: 'app-goal-track',
  standalone: true,
  imports: [
    ProgressTrackComponent,
    ProgressFillComponent,
    MarkLineComponent,
    TextComponent,
    PopoverTriggerDirective,
  ],
  template: `
    <div
      class="k-goal"
      [appPopoverTrigger]="goalPopoverKey()"
      [popoverDetails]="popoverDetails()"
    >
      <div class="g-row">
        <app-text tone="muted">{{ label() }}</app-text>
        <b [class.r]="risk()">{{ headline() }}</b>
      </div>
      <app-progress-track variant="goal">
        <app-progress-fill [width]="trackPct()" [variant]="risk() ? 'risk' : 'default'" />
        @if (planPct() > 0 && planPct() < 100) {
          <app-mark-line [position]="planPct()" />
        }
      </app-progress-track>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }

    .k-goal {
      min-width: 0;
      max-width: 100%;
      padding-top: var(--kpi-footer-padding-top);
      border-top: 1px solid var(--border-subtle);
      cursor: pointer;
      box-sizing: border-box;
    }
    .g-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      min-width: 0;
      min-height: var(--kpi-footer-row-height);
      font-size: 0.7rem;
      color: var(--mut);
      margin-bottom: var(--kpi-footer-track-gap);
    }

    .g-row > app-text {
      display: block;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .g-row b {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
  /** Pace-засечка (forecastToday/forecast); только незавершённый период, 0 — скрыть. */
  readonly planPct = input(0);
  readonly risk = input(false);
  readonly goalPopoverKey = input<string | undefined>();
  readonly popoverDetails = input<Record<string, DetailPopover>>({});
}

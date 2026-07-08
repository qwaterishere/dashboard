import { Component, input } from '@angular/core';

@Component({
  selector: 'app-mark-line',
  standalone: true,
  template: `<span class="mark" [style.left.%]="position()"></span>`,
  styles: `
    .mark {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--mark-plan);
      transform: translateX(-50%);
    }
    :host(.mark--goal) .mark {
      background: var(--mark-goal);
      opacity: 0.65;
      top: -3px;
      bottom: -3px;
    }
  `,
  host: { '[class.mark--goal]': 'variant() === "goal"' },
})
export class MarkLineComponent {
  readonly position = input(90.9);
  readonly variant = input<'plan' | 'goal'>('plan');
}

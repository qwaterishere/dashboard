import { Component, input, model } from '@angular/core';

import { ButtonComponent } from '../../atoms/button/button.component';
import type { SegmentOption } from './segment-control.model';

@Component({
  selector: 'app-segment-control',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="seg" role="group">
      @for (opt of options(); track opt.value) {
        <app-button
          [variant]="value() === opt.value ? 'segment-on' : 'default'"
          (pressed)="value.set(opt.value)"
        >
          {{ opt.label }}
        </app-button>
      }
    </div>
  `,
  styles: `
    :host {
      flex-shrink: 0;
    }

    .seg {
      display: flex;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 11px;
      padding: 3px;
      gap: 2px;
    }
  `,
})
export class SegmentControlComponent<T extends string = string> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly value = model.required<T>();
}

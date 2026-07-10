import { Component, input, model } from '@angular/core';

import { ButtonComponent } from '../../atoms/button/button.component';
import type { SegmentOption } from './segment-control.model';

@Component({
  selector: 'app-segment-control',
  standalone: true,
  imports: [ButtonComponent],
  host: {
    '[class.seg-control--sm]': 'size() === "sm"',
    '[class.seg-control--foodcost]': 'tone() === "foodcost"',
  },
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

    :host(.seg-control--sm) .seg {
      border-radius: 9px;
    }

    :host(.seg-control--sm) ::ng-deep button {
      padding: 5px 12px;
      font-size: 0.73rem;
    }

    :host(.seg-control--foodcost) ::ng-deep button.btn--segment-on {
      background: linear-gradient(90deg, rgba(255, 107, 107, 0.35), rgba(255, 160, 80, 0.22));
      box-shadow: inset 0 0 0 1px rgba(255, 107, 107, 0.4);
    }
  `,
})
export class SegmentControlComponent<T extends string = string> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly value = model.required<T>();
  readonly size = input<'default' | 'sm'>('default');
  readonly tone = input<'default' | 'foodcost'>('default');
}

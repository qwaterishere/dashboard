import { Component, input } from '@angular/core';

import { TextComponent } from '../../atoms/text/text.component';
import { PopoverTriggerDirective } from '../../directives/popover-trigger.directive';
import type { DetailPopover } from '../../../shared/models';

@Component({
  selector: 'app-week-kpi-footer',
  standalone: true,
  imports: [TextComponent, PopoverTriggerDirective],
  template: `
    <div
      class="k-week"
      [class.k-week--interactive]="popoverKey()"
      [appPopoverTrigger]="popoverKey()"
      [popoverDetails]="popoverDetails()"
    >
      <div class="k-week__row">
        <app-text tone="muted">{{ label() }}</app-text>
        <b>{{ headline() }}</b>
      </div>
      <div class="k-week__track" aria-hidden="true"></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }

    .k-week {
      min-width: 0;
      max-width: 100%;
      padding-top: var(--kpi-footer-padding-top);
      border-top: 1px solid var(--border-subtle);
      box-sizing: border-box;
    }

    .k-week--interactive {
      cursor: pointer;
    }

    .k-week__row {
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

    .k-week__row > app-text {
      display: block;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .k-week__row b {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.74rem;
      font-weight: 800;
      color: var(--txt);
    }

    .k-week__track {
      height: var(--kpi-footer-track-height);
      flex-shrink: 0;
    }
  `,
})
export class WeekKpiFooterComponent {
  readonly label = input('Средний день');
  readonly headline = input.required<string>();
  readonly popoverKey = input<string | undefined>();
  readonly popoverDetails = input<Record<string, DetailPopover>>({});
}

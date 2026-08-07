import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type {
  AttentionActionKind,
  AttentionSeverity,
} from '../../../shared/utils/restaurant-attention.utils';

const TONE: Record<AttentionSeverity, string> = {
  info: 'var(--mut)',
  warn: '#e6a700',
  critical: 'var(--red)',
};

@Component({
  selector: 'app-attention-item',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="att"
      [class.att--critical]="severity() === 'critical'"
      [class.att--warn]="severity() === 'warn'"
      [class.att--info]="severity() === 'info'"
    >
      <span class="att__dot" [style.background]="dotColor()" aria-hidden="true"></span>
      <div class="att__body">
        <p class="att__title">{{ title() }}</p>
        @if (detail()) {
          <p class="att__detail">{{ detail() }}</p>
        }
        @if (actionLabel()) {
          @if (actionKind() === 'link' && link()) {
            <a
              class="att__action"
              [routerLink]="link()"
              [queryParams]="queryParams() ?? undefined"
              [fragment]="fragment() ?? undefined"
            >
              {{ actionLabel() }}
            </a>
          } @else if (actionKind() === 'sync') {
            <button type="button" class="att__action" (click)="action.emit('sync')">
              {{ actionLabel() }}
            </button>
          } @else if (actionKind() === 'none') {
            <button type="button" class="att__action" (click)="action.emit('retry')">
              {{ actionLabel() }}
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .att {
      display: grid;
      grid-template-columns: 8px 1fr;
      gap: 10px;
      align-items: start;
      padding: 10px 10px;
      border-radius: 10px;
      background: transparent;
    }

    .att--critical {
      background: color-mix(in srgb, var(--red) 8%, transparent);
    }

    .att--warn {
      background: color-mix(in srgb, #e6a700 10%, transparent);
    }

    .att--info {
      background: color-mix(in srgb, var(--mut) 8%, transparent);
    }

    .att__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 5px;
      flex: none;
    }

    .att__title {
      margin: 0;
      font-size: 0.76rem;
      line-height: 1.35;
      color: var(--txt);
      font-weight: 700;
    }

    .att__detail {
      margin: 3px 0 0;
      font-size: 0.7rem;
      line-height: 1.4;
      color: var(--mut);
      font-weight: 600;
    }

    .att__action {
      display: inline-block;
      margin-top: 6px;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--vio);
      cursor: pointer;
      text-decoration: none;

      &:hover {
        color: var(--txt);
      }

      &:focus-visible {
        outline: 2px solid var(--vio);
        outline-offset: 2px;
        border-radius: 4px;
      }
    }
  `,
})
export class AttentionItemComponent {
  readonly severity = input.required<AttentionSeverity>();
  readonly title = input.required<string>();
  readonly detail = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly actionKind = input<AttentionActionKind>('none');
  readonly link = input<string | null>(null);
  readonly fragment = input<string | null>(null);
  readonly queryParams = input<Record<string, string> | null>(null);

  readonly action = output<'sync' | 'retry'>();

  protected dotColor(): string {
    return TONE[this.severity()];
  }
}

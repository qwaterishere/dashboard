import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ATTENTION_TONE_COLOR } from '../../../shared/constants/attention-tone.constants';
import type {
  AttentionActionKind,
  AttentionSeverity,
} from '../../../shared/utils/restaurant-attention.utils';
import { DotComponent } from '../../atoms/dot/dot.component';
import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-attention-item',
  standalone: true,
  imports: [RouterLink, DotComponent, TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="att"
      [class.att--critical]="severity() === 'critical'"
      [class.att--warn]="severity() === 'warn'"
      [class.att--info]="severity() === 'info'"
    >
      <div class="att__head">
        <span class="att__dot-wrap" aria-hidden="true">
          <app-dot size="sm" [color]="dotColor()" />
        </span>
        <p class="att__title">{{ title() }}</p>
      </div>
      @if (detail()) {
        <app-text class="att__detail" tone="muted">{{ detail() }}</app-text>
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
  `,
  styles: `
    .att {
      display: flex;
      flex-direction: column;
      padding: 10px 10px;
      border-radius: 10px;
      background: transparent;
    }

    .att--critical {
      background: color-mix(in srgb, var(--red) 8%, transparent);
    }

    .att--warn {
      background: color-mix(in srgb, var(--amber) 12%, transparent);
    }

    .att--info {
      background: color-mix(in srgb, var(--mut) 8%, transparent);
    }

    .att__head {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .att__dot-wrap {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 8px;
      line-height: 0;
    }

    .att__dot-wrap app-dot {
      display: block;
      line-height: 0;
    }

    .att__title {
      margin: 0;
      font-size: 0.76rem;
      line-height: 1.35;
      color: var(--txt);
      font-weight: 700;
    }

    .att__detail {
      display: block;
      margin-top: 3px;
      margin-left: 18px;
      font-weight: 600;
      line-height: 1.4;
    }

    .att__action {
      display: inline-block;
      margin-top: 6px;
      margin-left: 18px;
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

  protected readonly dotColor = computed(() => {
    const sev = this.severity();
    if (sev === 'critical') return ATTENTION_TONE_COLOR.critical;
    if (sev === 'warn') return ATTENTION_TONE_COLOR.warn;
    return ATTENTION_TONE_COLOR.info;
  });
}

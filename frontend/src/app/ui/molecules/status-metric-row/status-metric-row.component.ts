import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-status-metric-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="metric" [attr.title]="hint() || null">
      <span class="metric__label">{{ label() }}</span>
      <span class="metric__value">{{ value() }}</span>
    </div>
  `,
  styles: `
    .metric {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.72rem;
      line-height: 1.35;
    }

    .metric__label {
      color: var(--mut2);
      flex: none;
    }

    .metric__value {
      color: var(--txt);
      font-weight: 650;
      text-align: right;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class StatusMetricRowComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string | null>(null);
}

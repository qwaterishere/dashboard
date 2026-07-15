import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { KFormatPipe, MillionsPipe, PctPipe } from '../../../../shared/pipes/format.pipes';
import { TextComponent } from '../../../../ui/atoms/text/text.component';

@Component({
  selector: 'app-target-fact-hint',
  standalone: true,
  imports: [TextComponent, MillionsPipe, PctPipe, KFormatPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="target-fact-hint">
      <app-text tone="muted">
        {{ prefix() }}
        @if (factPct() !== null) {
          <span class="target-fact-hint__value">{{ factPct()! | pct }}</span>
        } @else if (factMoney() !== null) {
          <span class="target-fact-hint__value">{{ factMoney()! | millions }}</span>
        }
        @if (paceMoney() !== null) {
          · темп ≈ <span class="target-fact-hint__value">{{ paceMoney()! | millions }}</span>
        }
        @if (amountMoney() !== null) {
          <span class="target-fact-hint__value">({{ amountMoney()! | kFormat }})</span>
        }
      </app-text>
    </p>
  `,
  styleUrl: './target-fact-hint.component.scss',
})
export class TargetFactHintComponent {
  readonly prefix = input.required<string>();
  readonly factPct = input<number | null>(null);
  readonly factMoney = input<number | null>(null);
  readonly paceMoney = input<number | null>(null);
  readonly amountMoney = input<number | null>(null);
}

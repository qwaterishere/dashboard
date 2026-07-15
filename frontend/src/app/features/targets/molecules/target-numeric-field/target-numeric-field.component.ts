import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { FieldInputComponent } from '../../../../ui/atoms/field-input/field-input.component';
import { TargetFactHintComponent } from '../target-fact-hint/target-fact-hint.component';

@Component({
  selector: 'app-target-numeric-field',
  standalone: true,
  imports: [FieldInputComponent, TargetFactHintComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="target-numeric-field">
      <label class="target-numeric-field__label" [for]="inputId()">{{ label() }}</label>
      <div class="target-numeric-field__row">
        <app-field-input
          class="target-numeric-field__input"
          [inputId]="inputId()"
          [name]="name()"
          type="number"
          inputMode="decimal"
          step="any"
          [disabled]="disabled()"
          [value]="displayValue()"
          (valueChange)="onValueChange($event)"
        />
        @if (suffix()) {
          <span class="target-numeric-field__suffix">{{ suffix() }}</span>
        }
      </div>
      @if (hintPrefix()) {
        <app-target-fact-hint
          [prefix]="hintPrefix()!"
          [factPct]="hintFactPct()"
          [factMoney]="hintFactMoney()"
          [paceMoney]="hintPaceMoney()"
          [amountMoney]="hintAmountMoney()"
        />
      }
    </div>
  `,
  styleUrl: './target-numeric-field.component.scss',
})
export class TargetNumericFieldComponent {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly name = input.required<string>();
  readonly suffix = input<string | undefined>(undefined);
  readonly disabled = input(false);

  readonly hintPrefix = input<string | undefined>(undefined);
  readonly hintFactPct = input<number | null>(null);
  readonly hintFactMoney = input<number | null>(null);
  readonly hintPaceMoney = input<number | null>(null);
  readonly hintAmountMoney = input<number | null>(null);

  readonly value = model.required<number>();

  displayValue(): string {
    const current = this.value();
    return Number.isFinite(current) ? String(current) : '';
  }

  onValueChange(raw: string): void {
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    this.value.set(Number.isFinite(parsed) ? parsed : 0);
  }
}

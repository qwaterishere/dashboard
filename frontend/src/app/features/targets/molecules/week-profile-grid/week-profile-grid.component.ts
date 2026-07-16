import { ChangeDetectionStrategy, Component, model, input } from '@angular/core';

import { FieldInputComponent } from '../../../../ui/atoms/field-input/field-input.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';

const WEEK_PROFILE_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

@Component({
  selector: 'app-week-profile-grid',
  standalone: true,
  imports: [FieldInputComponent, TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="week-profile">
      <div class="week-profile__head">
        <span class="week-profile__title">Профиль недели</span>
        <app-text tone="muted">коэффициенты нагрузки</app-text>
      </div>
      <div class="week-profile__grid" role="group" aria-label="Профиль недели">
        @for (label of labels; track label; let i = $index) {
          <label class="week-profile__cell" [for]="'week-profile-' + i">
            <span class="week-profile__day">{{ label }}</span>
            <app-field-input
              [inputId]="'week-profile-' + i"
              [name]="'week-profile-' + i"
              type="number"
              inputMode="decimal"
              step="0.01"
              [disabled]="disabled()"
              [value]="displayValue(i)"
              (valueChange)="onValueChange(i, $event)"
            />
          </label>
        }
      </div>
    </div>
  `,
  styleUrl: './week-profile-grid.component.scss',
})
export class WeekProfileGridComponent {
  readonly profile = model.required<number[]>();
  readonly disabled = input(false);

  protected readonly labels = WEEK_PROFILE_LABELS;

  displayValue(index: number): string {
    const values = this.profile();
    const current = values[index];
    return Number.isFinite(current) ? String(current) : '';
  }

  onValueChange(index: number, raw: string): void {
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    const next = [...this.profile()];
    next[index] = Number.isFinite(parsed) ? parsed : 0;
    this.profile.set(next);
  }
}

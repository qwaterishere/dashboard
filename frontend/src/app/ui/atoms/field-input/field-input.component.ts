import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-field-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="field-input-wrap" [class.field-input-wrap--steppers]="showSteppers()">
      <input
        class="field-input"
        [class.field-input--invalid]="invalid()"
        [class.field-input--steppers]="showSteppers()"
        [type]="type()"
        [attr.inputmode]="inputMode()"
        [attr.step]="step()"
        [attr.min]="min()"
        [attr.max]="max()"
        [id]="inputId()"
        [name]="name()"
        [placeholder]="placeholder()"
        [autocomplete]="autocomplete()"
        [disabled]="disabled()"
        [required]="required()"
        [(ngModel)]="value"
        (keydown.enter)="onEnter($event)"
      />
      @if (showSteppers()) {
        <div class="field-input__steppers" aria-hidden="true">
          <button
            type="button"
            class="field-input__step field-input__step--up"
            tabindex="-1"
            [disabled]="disabled()"
            aria-label="Увеличить"
            (mousedown)="$event.preventDefault()"
            (click)="stepBy(1)"
          >
            <span class="field-input__chevron"></span>
          </button>
          <button
            type="button"
            class="field-input__step field-input__step--down"
            tabindex="-1"
            [disabled]="disabled()"
            aria-label="Уменьшить"
            (mousedown)="$event.preventDefault()"
            (click)="stepBy(-1)"
          >
            <span class="field-input__chevron"></span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .field-input-wrap {
      position: relative;
      width: 100%;
    }

    .field-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card2);
      color: var(--txt);
      font: inherit;
      font-size: 0.88rem;
      padding: 11px 13px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .field-input--steppers {
      padding-right: 2.15rem;
    }

    .field-input[type='number'] {
      -moz-appearance: textfield;
      appearance: textfield;
    }

    .field-input[type='number']::-webkit-outer-spin-button,
    .field-input[type='number']::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .field-input[type='date'] {
      font-weight: 600;
      color-scheme: dark light;
    }

    .field-input:focus {
      outline: none;
      border-color: rgba(110, 107, 255, 0.65);
      box-shadow: 0 0 0 3px rgba(110, 107, 255, 0.18);
    }

    .field-input--invalid {
      border-color: rgba(255, 107, 107, 0.75);
    }

    .field-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .field-input__steppers {
      position: absolute;
      top: 50%;
      right: 5px;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .field-input__step {
      display: grid;
      place-items: center;
      width: 22px;
      height: 15px;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 5px;
      background: var(--card);
      color: var(--mut2);
      cursor: pointer;
      transition: border-color 0.14s, background 0.14s, color 0.14s;
    }

    .field-input__step:hover:not(:disabled) {
      color: var(--txt);
      border-color: rgba(110, 107, 255, 0.5);
      background: rgba(110, 107, 255, 0.14);
    }

    .field-input__step:active:not(:disabled) {
      background: rgba(110, 107, 255, 0.22);
    }

    .field-input__step:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .field-input__chevron {
      width: 0;
      height: 0;
      border-left: 3.5px solid transparent;
      border-right: 3.5px solid transparent;
    }

    .field-input__step--up .field-input__chevron {
      border-bottom: 4.5px solid currentColor;
      margin-bottom: 1px;
    }

    .field-input__step--down .field-input__chevron {
      border-top: 4.5px solid currentColor;
      margin-top: 1px;
    }
  `,
})
export class FieldInputComponent {
  readonly type = input<'text' | 'email' | 'password' | 'number' | 'date'>('text');
  readonly inputId = input.required<string>();
  readonly name = input.required<string>();
  readonly placeholder = input('');
  readonly autocomplete = input<string | undefined>(undefined);
  readonly step = input<string | undefined>(undefined);
  readonly inputMode = input<string | undefined>(undefined);
  readonly min = input<string | undefined>(undefined);
  readonly max = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  /** Снять фокус по Enter (удобно для числовых полей без submit-формы). */
  readonly blurOnEnter = input(false);

  readonly value = model('');

  protected readonly showSteppers = computed(() => this.type() === 'number');

  onEnter(event: Event): void {
    if (!this.blurOnEnter()) return;
    event.preventDefault();
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      target.blur();
    }
  }

  stepBy(direction: 1 | -1): void {
    if (this.disabled()) return;
    const step = resolveStep(this.step());
    const current = Number.parseFloat(this.value().replace(',', '.'));
    const base = Number.isFinite(current) ? current : 0;
    let next = base + direction * step;

    const min = parseBound(this.min());
    const max = parseBound(this.max());
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;

    next = roundToStep(next, step);
    this.value.set(formatStepValue(next, step));
  }
}

function resolveStep(raw: string | undefined): number {
  if (raw == null || raw === '' || raw === 'any') return 1;
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseBound(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function stepFractionDigits(step: number): number {
  if (!Number.isFinite(step) || Number.isInteger(step)) return 0;
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function roundToStep(value: number, step: number): number {
  const digits = Math.min(6, stepFractionDigits(step));
  return Number(value.toFixed(digits));
}

function formatStepValue(value: number, step: number): string {
  const digits = Math.min(6, stepFractionDigits(step));
  if (digits === 0) return String(Math.round(value));
  return String(Number(value.toFixed(digits)));
}

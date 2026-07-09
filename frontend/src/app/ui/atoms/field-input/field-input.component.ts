import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-field-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <input
      class="field-input"
      [class.field-input--invalid]="invalid()"
      [type]="type()"
      [id]="inputId()"
      [name]="name()"
      [placeholder]="placeholder()"
      [autocomplete]="autocomplete()"
      [disabled]="disabled()"
      [required]="required()"
      [(ngModel)]="value"
    />
  `,
  styles: `
    .field-input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card2);
      color: var(--txt);
      font: inherit;
      font-size: 0.88rem;
      padding: 11px 13px;
      transition: border-color 0.15s, box-shadow 0.15s;
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
  `,
})
export class FieldInputComponent {
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly inputId = input.required<string>();
  readonly name = input.required<string>();
  readonly placeholder = input('');
  readonly autocomplete = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly required = input(false);
  readonly invalid = input(false);

  readonly value = model('');
}

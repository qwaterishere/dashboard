import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TextComponent } from '../../atoms/text/text.component';
import { FieldInputComponent } from '../../atoms/field-input/field-input.component';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [FormsModule, TextComponent, FieldInputComponent],
  template: `
    <div class="form-field">
      <label class="field-label" [for]="inputId()">{{ label() }}</label>
      <app-field-input
        [inputId]="inputId()"
        [name]="name()"
        [type]="type()"
        [placeholder]="placeholder()"
        [autocomplete]="autocomplete()"
        [disabled]="disabled()"
        [required]="required()"
        [invalid]="!!error()"
        [(value)]="value"
      />
      @if (error()) {
        <app-text tone="danger" class="error">{{ error() }}</app-text>
      }
    </div>
  `,
  styles: `
    .form-field {
      display: grid;
      gap: 6px;
    }

    .field-label {
      font-weight: 600;
      color: var(--txt);
      font-size: 0.78rem;
    }
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly name = input.required<string>();
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
  readonly autocomplete = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly required = input(false);
  readonly error = input<string | undefined>(undefined);

  readonly value = model('');
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-form-banner',
  standalone: true,
  imports: [TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'variant() === "error" ? "alert" : "status"',
  },
  template: `
    <div [class]="classes()">
      <app-text [tone]="variant() === 'error' ? 'danger' : 'default'">{{ message() }}</app-text>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .form-banner--error {
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(255, 107, 107, 0.08);
      border: 1px solid rgba(255, 107, 107, 0.25);
    }

    .form-banner--success {
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(61, 220, 151, 0.08);
      border: 1px solid rgba(61, 220, 151, 0.25);
      color: var(--grn);
    }
  `,
})
export class FormBannerComponent {
  readonly variant = input.required<'error' | 'success'>();
  readonly message = input.required<string>();

  classes(): string {
    return `form-banner--${this.variant()}`;
  }
}

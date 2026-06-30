import { Component, input } from '@angular/core';

@Component({
  selector: 'app-load-error',
  standalone: true,
  template: `<div class="load-error" role="alert">{{ message() }}</div>`,
  styles: `
    .load-error {
      margin: 0 0 16px;
      padding: 12px 16px;
      border-radius: 11px;
      background: rgba(255, 107, 107, 0.12);
      border: 1px solid rgba(255, 107, 107, 0.35);
      color: var(--red);
      font-size: 0.82rem;
      font-weight: 600;
    }
  `,
})
export class LoadErrorComponent {
  readonly message = input('Не удалось загрузить данные');
}

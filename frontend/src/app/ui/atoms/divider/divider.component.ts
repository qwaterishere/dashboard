import { Component } from '@angular/core';

/**
 * Горизонтальный разделитель. Занимает 100% ширины родителя.
 * Вертикальные/горизонтальные отступы — ответственность layout (organism / template).
 */
@Component({
  selector: 'app-divider',
  standalone: true,
  template: `<hr class="divider" />`,
  styles: `
    :host {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .divider {
      display: block;
      width: 100%;
      height: 0;
      margin: 0;
      padding: 0;
      border: 0;
      border-top: 1px solid var(--border-subtle);
    }
  `,
})
export class DividerComponent {}

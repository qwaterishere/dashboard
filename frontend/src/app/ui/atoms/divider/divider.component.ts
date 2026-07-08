import { Component, input } from '@angular/core';

@Component({
  selector: 'app-divider',
  standalone: true,
  template: `<div [class]="classes()"></div>`,
  styles: `
    .divider { height: 1px; background: var(--border-subtle); }
    .divider--nav { margin: 18px 8px; }
    .divider--right { margin: 22px 0; }
  `,
})
export class DividerComponent {
  readonly variant = input<'nav' | 'right'>('nav');

  classes(): string {
    return `divider divider--${this.variant()}`;
  }
}

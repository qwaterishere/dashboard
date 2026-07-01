import { Component, input } from '@angular/core';

@Component({
  selector: 'app-text',
  standalone: true,
  template: `<span [class]="classes()"><ng-content /></span>`,
  styles: `
    .text { color: var(--txt); }
    .text--muted { color: var(--mut); font-size: 0.7rem; }
    .text--muted2 { color: var(--mut2); font-size: 0.72rem; }
    .text--caption { color: var(--mut2); font-size: 0.68rem; }
  `,
})
export class TextComponent {
  readonly tone = input<'default' | 'muted' | 'muted2' | 'caption'>('default');

  classes(): string {
    return this.tone() === 'default' ? 'text' : `text text--${this.tone()}`;
  }
}

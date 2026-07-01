import { Component, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span [class]="classes()">{{ label() }}</span>`,
  styles: `
    span {
      display: inline-flex;
      align-items: center;
      font-weight: 700;
      border-radius: 99px;
    }
    .badge--nav {
      margin-left: auto;
      background: var(--vio);
      color: #fff;
      font-size: 0.66rem;
      padding: 2px 7px;
    }
    .badge--tag {
      font-size: 0.66rem;
      padding: 2px 8px;
      background: var(--card2);
      border: 1px solid var(--line);
      color: var(--mut);
    }
    .badge--abc-a { background: rgba(61, 220, 151, 0.15); color: var(--grn); padding: 2px 8px; font-size: 0.72rem; }
    .badge--abc-b { background: rgba(201, 161, 75, 0.15); color: #d9b45f; padding: 2px 8px; font-size: 0.72rem; }
    .badge--abc-c { background: rgba(255, 107, 107, 0.12); color: var(--red); padding: 2px 8px; font-size: 0.72rem; }
  `,
})
export class BadgeComponent {
  readonly label = input.required<string>();
  readonly variant = input<'nav' | 'tag' | 'abc-a' | 'abc-b' | 'abc-c'>('tag');

  classes(): string {
    return `badge--${this.variant()}`;
  }
}

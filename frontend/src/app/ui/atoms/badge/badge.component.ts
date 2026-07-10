import { Component, computed, input } from '@angular/core';

export type BadgeVariant = 'nav' | 'tag' | 'abc';

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
    .badge--tag {
      font-size: 0.66rem;
      padding: 2px 8px;
      background: var(--card2);
      border: 1px solid var(--line);
      color: var(--mut);
    }
    .badge--nav {
      background: var(--vio);
      color: #fff;
      font-size: 0.66rem;
      padding: 2px 7px;
    }
    .badge--abc-a { background: rgba(61, 220, 151, 0.15); color: var(--grn); padding: 2px 8px; font-size: 0.72rem; }
    .badge--abc-b { background: rgba(201, 161, 75, 0.15); color: var(--amber); padding: 2px 8px; font-size: 0.72rem; }
    .badge--abc-c { background: rgba(255, 107, 107, 0.12); color: var(--red); padding: 2px 8px; font-size: 0.72rem; }
  `,
})
export class BadgeComponent {
  readonly label = input.required<string>();
  readonly variant = input<BadgeVariant>('tag');

  protected readonly classes = computed(() => {
    const variant = this.variant();
    if (variant === 'abc') {
      const letter = this.label().trim().charAt(0).toUpperCase();
      if (letter === 'A' || letter === 'B' || letter === 'C') {
        return `badge--abc-${letter.toLowerCase()}`;
      }
      return 'badge--abc-c';
    }
    return `badge--${variant}`;
  });
}

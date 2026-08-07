import { Component, computed, input } from '@angular/core';

import { CAT_COLOR } from '../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../shared/models';

export type DotVariant = CategoryKey | 'default';
export type DotSize = 'sm' | 'md';

@Component({
  selector: 'app-dot',
  standalone: true,
  template: `<span class="dot" [class.dot--sm]="size() === 'sm'" [style.background]="fill()"></span>`,
  styles: `
    :host {
      display: block;
      line-height: 0;
      flex: none;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      display: block;
    }
    .dot--sm {
      width: 8px;
      height: 8px;
    }
  `,
})
export class DotComponent {
  /** Семантический цвет из палитры категорий. */
  readonly variant = input<DotVariant>('default');

  /** Явный цвет (token/hex) — override для legend / attention tones. */
  readonly color = input<string | undefined>(undefined);

  readonly size = input<DotSize>('md');

  protected readonly fill = computed(() => {
    const explicit = this.color();
    if (explicit) return explicit;
    const variant = this.variant();
    return variant === 'default' ? CAT_COLOR.k : CAT_COLOR[variant];
  });
}

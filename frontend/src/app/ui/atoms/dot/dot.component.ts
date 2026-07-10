import { Component, computed, input } from '@angular/core';

import { CAT_COLOR } from '../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../shared/models';

export type DotVariant = CategoryKey | 'default';

@Component({
  selector: 'app-dot',
  standalone: true,
  template: `<span class="dot" [style.background]="fill()"></span>`,
  styles: `
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex: none;
      display: inline-block;
    }
  `,
})
export class DotComponent {
  /** Семантический цвет из палитры категорий. */
  readonly variant = input<DotVariant>('default');

  /** Явный hex — override для данных из API/чартов (например legend-row). */
  readonly color = input<string | undefined>(undefined);

  protected readonly fill = computed(() => {
    const explicit = this.color();
    if (explicit) return explicit;
    const variant = this.variant();
    return variant === 'default' ? CAT_COLOR.k : CAT_COLOR[variant];
  });
}

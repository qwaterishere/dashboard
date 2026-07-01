import { Component, input } from '@angular/core';

import type { CategoryKey } from '../../../shared/models';
import { CAT_FILL_CLASS } from '../../../shared/constants/category.constants';

@Component({
  selector: 'app-progress-fill',
  standalone: true,
  template: `<i [class]="classes()" [style.width.%]="width()"></i>`,
  styles: `
    i {
      display: block;
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(90deg, var(--grn2), var(--grn));
      box-shadow: 0 0 8px rgba(61, 220, 151, 0.35);
    }
    i.v {
      background: linear-gradient(90deg, #4b49c9, var(--vio2));
      box-shadow: 0 0 8px rgba(110, 107, 255, 0.35);
    }
    i.w {
      background: linear-gradient(90deg, #8a2d52, #c7466f);
      box-shadow: 0 0 8px rgba(199, 70, 111, 0.3);
    }
    i.good { background: var(--grn); box-shadow: none; }
    i.mid { background: #c9a14b; box-shadow: none; }
    i.bad { background: var(--red); box-shadow: none; }
    i.r {
      background: linear-gradient(90deg, #b0413a, var(--red));
      box-shadow: 0 0 8px rgba(255, 107, 107, 0.4);
    }
  `,
})
export class ProgressFillComponent {
  readonly width = input(0);
  readonly category = input<CategoryKey | null>(null);
  readonly variant = input<'default' | 'good' | 'mid' | 'bad' | 'risk'>('default');

  classes(): string {
    const cat = this.category();
    if (cat) {
      const cls = CAT_FILL_CLASS[cat];
      return cls || '';
    }
    const v = this.variant();
    if (v === 'risk') return 'r';
    if (v !== 'default') return v;
    return '';
  }
}

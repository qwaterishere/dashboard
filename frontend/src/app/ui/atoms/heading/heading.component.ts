import { Component, input } from '@angular/core';

@Component({
  selector: 'app-heading',
  standalone: true,
  template: `
    @switch (level()) {
      @case (1) {
        <h1 [class]="classes()">{{ text() }}</h1>
      }
      @case (2) {
        <h2 [class]="classes()">{{ text() }}</h2>
      }
      @case (3) {
        <h3 [class]="classes()">{{ text() }}</h3>
      }
      @default {
        <h4 [class]="classes()">{{ text() }}</h4>
      }
    }
  `,
  styles: `
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
    }

    h3 {
      font-size: 0.98rem;
      font-weight: 700;
    }

    h4 {
      font-size: 0.95rem;
      font-weight: 700;
    }

    .big {
      font-weight: 800;
      font-size: 1.42rem;
      letter-spacing: -0.01em;
      color: var(--txt);
    }
  `,
})
export class HeadingComponent {
  readonly level = input<1 | 2 | 3 | 4>(1);
  readonly variant = input<'default' | 'big'>('default');
  readonly text = input.required<string>();

  classes(): string {
    return this.variant() === 'big' ? 'big' : '';
  }
}

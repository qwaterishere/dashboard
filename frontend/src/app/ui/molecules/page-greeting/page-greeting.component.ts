import { Component, input } from '@angular/core';

export type PageHeadlineVariant = 'greeting' | 'title';

@Component({
  selector: 'app-page-greeting',
  standalone: true,
  template: `
    <div class="head">
      <h1>
        {{ headline() }}
        @if (variant() === 'greeting') {
          <em>!</em>
        }
      </h1>
    </div>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: var(--page-greeting-margin-bottom);
    }

    h1 {
      font-size: var(--page-greeting-font-size);
      font-weight: 700;
      line-height: var(--page-greeting-line-height);
    }

    em {
      font-style: normal;
      color: var(--grn);
    }
  `,
})
export class PageGreetingComponent {
  readonly headline = input.required<string>();
  readonly variant = input<PageHeadlineVariant>('greeting');
}

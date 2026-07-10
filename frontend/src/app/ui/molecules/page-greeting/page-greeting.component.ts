import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-greeting',
  standalone: true,
  template: `
    <div class="head">
      <h1>{{ greeting() }}<em>!</em></h1>
    </div>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 22px;
    }

    h1 {
      font-size: 1.35rem;
      font-weight: 700;
    }

    em {
      font-style: normal;
      color: var(--grn);
    }
  `,
})
export class PageGreetingComponent {
  readonly greeting = input.required<string>();
}

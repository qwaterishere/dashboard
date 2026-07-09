import { Component, computed, inject } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';

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
  private readonly auth = inject(AuthService);

  protected readonly greeting = computed(() => {
    const user = this.auth.user();
    const name = user?.first_name ?? 'коллега';
    const hour = new Date().getHours();
    const salute = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    return `${salute}, ${name}`;
  });
}

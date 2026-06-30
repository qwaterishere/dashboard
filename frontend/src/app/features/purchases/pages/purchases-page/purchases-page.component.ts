import { Component } from '@angular/core';

@Component({
  selector: 'app-purchases-page',
  standalone: true,
  template: `<p class="stub">Раздел в разработке (Фаза 7)</p>`,
  styles: `
    :host {
      display: block;
    }

    .stub {
      color: var(--mut2);
    }
  `,
})
export class PurchasesPageComponent {}

import { Component, inject } from '@angular/core';

import { DashboardDataStore } from '../../data/dashboard-data.store';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { ProfileBlockComponent } from '../../../../ui/molecules/profile-block/profile-block.component';
import { DividerComponent } from '../../../../ui/atoms/divider/divider.component';
import { CategoriesPanelOrganismComponent } from '../../organisms/categories-panel/categories-panel-organism.component';
import { StockPanelOrganismComponent } from '../../organisms/stock-panel/stock-panel-organism.component';

@Component({
  selector: 'app-dashboard-right-panel',
  standalone: true,
  imports: [
    LoadErrorComponent,
    ProfileBlockComponent,
    DividerComponent,
    CategoriesPanelOrganismComponent,
    StockPanelOrganismComponent,
  ],
  template: `
    @if (dashboard.hasValue()) {
      @let d = dashboard.value();
      <aside class="right">
        <app-profile-block />
        <app-categories-panel-organism [categories]="d.categories" />
        <app-divider variant="right" />
        <app-stock-panel-organism [stock]="d.stock" />
      </aside>
    } @else if (dashboard.error()) {
      <aside class="right"><app-load-error message="Не удалось загрузить боковую панель" /></aside>
    } @else {
      <aside class="right"><p class="loading">Загрузка…</p></aside>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .right {
      grid-column: 3;
      grid-row: 1;
      width: var(--right-panel-width, 296px);
      max-width: var(--right-panel-width, 296px);
      min-width: var(--right-panel-width, 296px);
      padding: 24px 22px;
      border-left: 1px solid #141a2b;
      background: #0b101d;
      align-self: stretch;
    }

    .loading {
      color: var(--mut2);
      font-size: 0.9rem;
    }

    @media (max-width: 1180px) {
      .right {
        display: none;
      }
    }
  `,
})
export class DashboardRightPanelComponent {
  private readonly store = inject(DashboardDataStore);
  protected readonly dashboard = this.store.dashboard;
}

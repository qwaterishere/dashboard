import { Component, inject } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { DashboardDataStore } from '../../data/dashboard-data.store';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { ProfileBlockComponent } from '../../../../ui/molecules/profile-block/profile-block.component';
import { DividerComponent } from '../../../../ui/atoms/divider/divider.component';
import { CategoriesPanelOrganismComponent } from '../../organisms/categories-panel/categories-panel-organism.component';
import { StockPanelOrganismComponent } from '../../organisms/stock-panel/stock-panel-organism.component';
import {
  RIGHT_PANEL_HIDE_BREAKPOINT_PX,
  RIGHT_PANEL_WIDTH_PX,
} from '../../../../shared/constants/layout.constants';

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
    <aside class="right">
      <app-profile-block
        [initials]="auth.initials()"
        [name]="auth.displayName()"
        [role]="auth.user()?.position ?? ''"
        (logout)="onLogout()"
      />
      @if (viewModel(); as d) {
        <app-categories-panel-organism [categories]="d.categories" />
        @if (d.stock) {
          <app-divider class="panel-divider" />
          <app-stock-panel-organism [stock]="d.stock" />
        }
      } @else if (dashboard.error()) {
        <app-load-error message="Не удалось загрузить боковую панель" />
      } @else {
        <p class="loading">Загрузка…</p>
      }
    </aside>
  `,
  styles: `
    :host {
      display: contents;
    }

    .right {
      grid-column: 3;
      grid-row: 1;
      width: var(--right-panel-width, ${RIGHT_PANEL_WIDTH_PX}px);
      max-width: var(--right-panel-width, ${RIGHT_PANEL_WIDTH_PX}px);
      min-width: var(--right-panel-width, ${RIGHT_PANEL_WIDTH_PX}px);
      height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 24px 22px;
      border-left: 1px solid var(--border-strong);
      background: var(--surface-right);
      align-self: start;
    }

    .loading {
      color: var(--mut2);
      font-size: 0.9rem;
    }

    .panel-divider {
      margin: 22px 0;
    }

    @media (max-width: ${RIGHT_PANEL_HIDE_BREAKPOINT_PX}px) {
      .right {
        display: none;
      }
    }
  `,
})
export class DashboardRightPanelComponent {
  private readonly store = inject(DashboardDataStore);
  protected readonly auth = inject(AuthService);
  protected readonly dashboard = this.store.dashboard;
  protected readonly viewModel = this.store.viewModel;

  protected onLogout(): void {
    this.auth.logoutAndRedirect();
  }
}

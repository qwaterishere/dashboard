import { Component, inject } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ProfileBlockComponent } from '../../../../ui/molecules/profile-block/profile-block.component';
import {
  RIGHT_PANEL_HIDE_BREAKPOINT_PX,
  RIGHT_PANEL_WIDTH_PX,
} from '../../../../shared/constants/layout.constants';

@Component({
  selector: 'app-dashboard-right-panel',
  standalone: true,
  imports: [ProfileBlockComponent],
  template: `
    <aside class="right app-scroll">
      <app-profile-block
        [initials]="auth.initials()"
        [name]="auth.displayName()"
        [role]="auth.user()?.position ?? ''"
        (logout)="onLogout()"
      />
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

    @media (max-width: ${RIGHT_PANEL_HIDE_BREAKPOINT_PX}px) {
      .right {
        display: none;
      }
    }
  `,
})
export class DashboardRightPanelComponent {
  protected readonly auth = inject(AuthService);

  protected onLogout(): void {
    this.auth.logoutAndRedirect();
  }
}

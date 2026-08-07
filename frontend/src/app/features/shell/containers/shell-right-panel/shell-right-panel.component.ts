import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { catchError, of, take } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { DataFreshnessService } from '../../../../core/data/data-freshness.service';
import { ThemeService } from '../../../../core/state/theme.service';
import { AttentionDataStore } from '../../data/attention-data.store';
import { SettingsService } from '../../../settings/services/settings.service';
import { buildRestaurantAttentionVm } from '../../../../shared/utils/restaurant-attention.utils';
import { ProfileBlockComponent } from '../../../../ui/organisms/profile-block/profile-block.component';
import { RestaurantAttentionOrganismComponent } from '../../../../ui/organisms/restaurant-attention/restaurant-attention-organism.component';

@Component({
  selector: 'app-shell-right-panel',
  standalone: true,
  imports: [ProfileBlockComponent, RestaurantAttentionOrganismComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="right app-scroll" aria-label="Сейчас важно">
      <app-profile-block
        [initials]="auth.initials()"
        [name]="auth.displayName()"
        [role]="auth.user()?.position ?? ''"
        [isDark]="isDark()"
        (themeToggled)="onThemeToggle()"
        (logout)="onLogout()"
      />
      <app-restaurant-attention-organism
        [vm]="attentionVm()"
        (syncRequested)="onSync()"
        (retryRequested)="onRetry()"
      />
    </aside>
  `,
  styleUrl: './shell-right-panel.component.scss',
})
export class ShellRightPanelComponent {
  protected readonly auth = inject(AuthService);
  private readonly freshness = inject(DataFreshnessService);
  private readonly settings = inject(SettingsService);
  private readonly theme = inject(ThemeService);
  private readonly attentionStore = inject(AttentionDataStore);

  private readonly syncBusy = signal(false);

  protected readonly isDark = computed(() => this.theme.theme() === 'dark');

  protected readonly attentionVm = computed(() =>
    buildRestaurantAttentionVm({
      attention: this.attentionStore.attention(),
      attentionLoading: this.attentionStore.isLoading(),
      attentionLoadError: this.attentionStore.hasError(),
      freshness: this.freshness.freshness(),
      freshnessLoading: this.freshness.loading(),
      freshnessLoadError: this.freshness.loadError(),
      syncBusy: this.syncBusy(),
    }),
  );

  protected onLogout(): void {
    this.auth.logoutAndRedirect();
  }

  protected onThemeToggle(): void {
    this.theme.toggle();
  }

  protected onRetry(): void {
    this.freshness.refresh(false);
    this.attentionStore.reload();
  }

  protected onSync(): void {
    if (this.syncBusy()) return;
    const trust = this.attentionVm().trust;
    if (trust?.cta.kind === 'configure') return;

    this.syncBusy.set(true);
    this.settings
      .syncIiko(false)
      .pipe(
        take(1),
        catchError(() => {
          this.syncBusy.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.syncBusy.set(false);
        this.attentionStore.reload();
        this.freshness.refresh(true);
        if (!res) {
          // sync start failed — still refresh trust strip
        }
      });
  }
}

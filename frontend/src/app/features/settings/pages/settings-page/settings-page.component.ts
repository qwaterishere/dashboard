import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, signal, DestroyRef, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { switchMap, timer, takeWhile, filter, startWith } from 'rxjs';

import type { ChangePasswordRequest, UpdateProfileRequest } from '../../../../shared/models/auth.model';
import type { UpdateIikoSettingsRequest } from '../../../../shared/models/iiko-settings.model';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { SettingsLayoutTemplateComponent } from '../../../../ui/templates/settings-layout/settings-layout-template.component';
import { AccountInfoOrganismComponent } from '../../organisms/account-info/account-info-organism.component';
import { CurrencySettingsOrganismComponent } from '../../organisms/currency-settings/currency-settings-organism.component';
import { IikoSettingsOrganismComponent } from '../../organisms/iiko-settings/iiko-settings-organism.component';
import { PasswordSettingsOrganismComponent } from '../../organisms/password-settings/password-settings-organism.component';
import { ProfileSettingsOrganismComponent } from '../../organisms/profile-settings/profile-settings-organism.component';
import { TargetsLockSettingsOrganismComponent } from '../../organisms/targets-lock-settings/targets-lock-settings-organism.component';
import { resolveIikoSyncError, resolveSettingsError } from '../../settings-errors';
import { SettingsService } from '../../services/settings.service';
import {
  isIikoSyncFragment,
  scrollToIikoSyncAnchor,
} from '../../../../shared/utils/scroll-to-iiko-sync.util';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadErrorComponent,
    SettingsLayoutTemplateComponent,
    ProfileSettingsOrganismComponent,
    CurrencySettingsOrganismComponent,
    PasswordSettingsOrganismComponent,
    IikoSettingsOrganismComponent,
    TargetsLockSettingsOrganismComponent,
    AccountInfoOrganismComponent,
  ],
  template: `
    <app-settings-layout-template>
      @if (user(); as profile) {
        <app-profile-settings-organism
          [user]="profile"
          [loading]="profileLoading()"
          [error]="profileError()"
          [success]="profileSuccess()"
          (saved)="onProfileSave($event)"
        />
        <app-currency-settings-organism />
        <app-iiko-settings-organism
          [settings]="iikoSettings()"
          [settingsLoading]="iikoSettingsLoading()"
          [settingsLoadError]="iikoSettingsLoadError()"
          [loading]="iikoSaving()"
          [error]="iikoError()"
          [success]="iikoSuccess()"
          [syncLoading]="iikoSyncLoading()"
          [syncError]="iikoSyncError()"
          [syncSuccess]="iikoSyncSuccess()"
          (saved)="onIikoSave($event)"
          (syncRequested)="onIikoSync(false)"
          (resyncRequested)="onIikoSync(true)"
        />
        <app-targets-lock-settings-organism />
        <app-password-settings-organism
          [loading]="passwordLoading()"
          [error]="passwordError()"
          [success]="passwordSuccess()"
          (saved)="onPasswordSave($event)"
        />
        <app-account-info-organism [user]="profile" />
      } @else {
        <app-load-error message="Не удалось загрузить профиль" />
      }
    </app-settings-layout-template>
  `,
})
export class SettingsPageComponent {
  private readonly settings = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly user = this.settings.user;
  protected readonly iikoSettings = this.settings.iikoSettings;
  protected readonly iikoSettingsLoading = this.settings.iikoSettingsLoading;
  protected readonly iikoSettingsLoadError = this.settings.iikoSettingsLoadError;

  protected readonly profileLoading = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileSuccess = signal(false);

  protected readonly iikoSaving = signal(false);
  protected readonly iikoError = signal<string | null>(null);
  protected readonly iikoSuccess = signal(false);

  protected readonly iikoSyncLoading = signal(false);
  protected readonly iikoSyncError = signal<string | null>(null);
  protected readonly iikoSyncSuccess = signal(false);

  protected readonly passwordLoading = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordSuccess = signal(false);

  constructor() {
    this.settings.loadIikoSettings().subscribe({
      next: (settings) => {
        if (settings.sync.status === 'running') {
          this.iikoSyncLoading.set(true);
          this.pollIikoSyncStatus();
        }
      },
      error: () => undefined,
    });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.scheduleIikoSyncScroll());

    effect(() => {
      const fragment = this.router.parseUrl(this.router.url).fragment;
      if (!isIikoSyncFragment(fragment)) {
        return;
      }
      const profileReady = this.user() !== null;
      const iikoReady = !this.iikoSettingsLoading();
      if (!profileReady || !iikoReady) {
        return;
      }
      untracked(() => this.scheduleIikoSyncScroll());
    });
  }

  private scheduleIikoSyncScroll(): void {
    if (!isIikoSyncFragment(this.router.parseUrl(this.router.url).fragment)) {
      return;
    }
    queueMicrotask(() => scrollToIikoSyncAnchor());
  }

  onProfileSave(payload: UpdateProfileRequest): void {
    this.profileLoading.set(true);
    this.profileError.set(null);
    this.profileSuccess.set(false);

    this.settings.updateProfile(payload).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.profileSuccess.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.profileLoading.set(false);
        this.profileError.set(resolveSettingsError(err));
      },
    });
  }

  onIikoSave(payload: UpdateIikoSettingsRequest): void {
    this.iikoSaving.set(true);
    this.iikoError.set(null);
    this.iikoSuccess.set(false);

    this.settings.updateIikoSettings(payload).subscribe({
      next: () => {
        this.iikoSaving.set(false);
        this.iikoSuccess.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.iikoSaving.set(false);
        this.iikoError.set(resolveSettingsError(err));
      },
    });
  }

  onIikoSync(full: boolean): void {
    this.iikoSyncLoading.set(true);
    this.iikoSyncError.set(null);
    this.iikoSyncSuccess.set(false);

    this.settings.syncIiko(full).subscribe({
      next: () => {
        this.pollIikoSyncStatus();
      },
      error: (err: HttpErrorResponse) => {
        this.iikoSyncLoading.set(false);
        this.iikoSyncError.set(resolveIikoSyncError(err));
      },
    });
  }

  private pollIikoSyncStatus(): void {
    timer(0, 2000)
      .pipe(
        switchMap(() => this.settings.refreshIikoSettings()),
        takeWhile((settings) => settings.sync.status === 'running', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (settings) => {
          if (settings.sync.status === 'running') {
            return;
          }
          this.iikoSyncLoading.set(false);
          if (settings.sync.status === 'success' || settings.sync.status === 'noop') {
            this.iikoSyncSuccess.set(true);
            return;
          }
          if (settings.sync.status === 'error') {
            this.iikoSyncError.set(settings.sync.error ?? 'Не удалось загрузить данные из iiko');
          }
        },
        error: () => {
          this.iikoSyncLoading.set(false);
          this.iikoSyncError.set('Не удалось проверить статус загрузки');
        },
      });
  }

  onPasswordSave(payload: ChangePasswordRequest): void {
    this.passwordLoading.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(false);

    this.settings.changePassword(payload).subscribe({
      next: () => {
        this.passwordLoading.set(false);
        this.passwordSuccess.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.passwordLoading.set(false);
        this.passwordError.set(resolveSettingsError(err));
      },
    });
  }
}

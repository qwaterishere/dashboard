import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import type { ChangePasswordRequest, UpdateProfileRequest } from '../../../../shared/models/auth.model';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { SettingsLayoutTemplateComponent } from '../../../../ui/templates/settings-layout/settings-layout-template.component';
import { AccountInfoOrganismComponent } from '../../organisms/account-info/account-info-organism.component';
import { PasswordSettingsOrganismComponent } from '../../organisms/password-settings/password-settings-organism.component';
import { ProfileSettingsOrganismComponent } from '../../organisms/profile-settings/profile-settings-organism.component';
import { resolveSettingsError } from '../../settings-errors';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadErrorComponent,
    SettingsLayoutTemplateComponent,
    ProfileSettingsOrganismComponent,
    PasswordSettingsOrganismComponent,
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

  protected readonly user = this.settings.user;

  protected readonly profileLoading = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileSuccess = signal(false);

  protected readonly passwordLoading = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordSuccess = signal(false);

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

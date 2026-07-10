import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { ChangePasswordRequest } from '../../../../shared/models/auth.model';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '../../../../shared/constants/password.constants';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { FormBannerComponent } from '../../../../ui/molecules/form-banner/form-banner.component';
import { FormFieldComponent } from '../../../../ui/molecules/form-field/form-field.component';
import { SettingsSectionComponent } from '../../../../ui/molecules/settings-section/settings-section.component';

@Component({
  selector: 'app-password-settings-organism',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    TextComponent,
    FormBannerComponent,
    FormFieldComponent,
    SettingsSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-settings-section
      title="Смена пароля"
      description="После смены пароля все активные сессии будут завершены, кроме текущей."
    >
      @if (bannerMessage(); as message) {
        <app-form-banner [variant]="bannerVariant()!" [message]="message" />
      }

      <form class="form-grid" (ngSubmit)="onSubmit()">
        <app-form-field
          label="Текущий пароль"
          inputId="settings-current-password"
          name="current_password"
          type="password"
          autocomplete="current-password"
          [required]="true"
          [(value)]="currentPassword"
        />
        <app-form-field
          label="Новый пароль"
          inputId="settings-new-password"
          name="new_password"
          type="password"
          autocomplete="new-password"
          [required]="true"
          [(value)]="newPassword"
        />
        <app-form-field
          label="Подтверждение пароля"
          inputId="settings-confirm-password"
          name="confirm_password"
          type="password"
          autocomplete="new-password"
          [required]="true"
          [error]="confirmError()"
          [(value)]="confirmPassword"
        />
        <app-text tone="caption">{{ passwordHint }}</app-text>
        <app-button variant="primary" type="submit" [disabled]="loading()">
          {{ loading() ? 'Обновление…' : 'Сменить пароль' }}
        </app-button>
      </form>
    </app-settings-section>
  `,
  styleUrl: './password-settings-organism.component.scss',
})
export class PasswordSettingsOrganismComponent {
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly success = input(false);
  readonly saved = output<ChangePasswordRequest>();

  protected readonly passwordHint = PASSWORD_HINT;

  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';

  private readonly localError = signal<string | null>(null);

  protected readonly bannerVariant = computed<'error' | 'success' | null>(() => {
    if (this.localError() || this.error()) return 'error';
    if (this.success()) return 'success';
    return null;
  });

  protected readonly bannerMessage = computed(() => {
    if (this.localError()) return this.localError();
    if (this.error()) return this.error();
    if (this.success()) return 'Пароль обновлён';
    return null;
  });

  constructor() {
    effect(() => {
      if (this.success()) {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.localError.set(null);
      }
    });

    effect(() => {
      if (this.error()) {
        this.localError.set(null);
      }
    });
  }

  confirmError(): string | undefined {
    if (!this.confirmPassword) return undefined;
    if (this.newPassword !== this.confirmPassword) return 'Пароли не совпадают';
    return undefined;
  }

  onSubmit(): void {
    this.localError.set(null);

    if (!this.currentPassword) {
      this.localError.set('Введите текущий пароль');
      return;
    }
    if (this.newPassword.length < PASSWORD_MIN_LENGTH) {
      this.localError.set(`Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`);
      return;
    }
    if (this.newPassword === this.currentPassword) {
      this.localError.set('Новый пароль должен отличаться от текущего');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.localError.set('Пароли не совпадают');
      return;
    }

    this.saved.emit({
      current_password: this.currentPassword,
      new_password: this.newPassword,
    });
  }
}

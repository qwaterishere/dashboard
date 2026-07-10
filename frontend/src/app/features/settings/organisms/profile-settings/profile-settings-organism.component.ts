import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { UpdateProfileRequest, UserPublic } from '../../../../shared/models/auth.model';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { FormBannerComponent } from '../../../../ui/molecules/form-banner/form-banner.component';
import { FormFieldComponent } from '../../../../ui/molecules/form-field/form-field.component';
import { SettingsSectionComponent } from '../../../../ui/molecules/settings-section/settings-section.component';

@Component({
  selector: 'app-profile-settings-organism',
  standalone: true,
  imports: [FormsModule, ButtonComponent, FormBannerComponent, FormFieldComponent, SettingsSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-settings-section
      title="Профиль"
      description="Имя и должность отображаются в интерфейсе. Email изменить нельзя без подтверждения."
    >
      @if (bannerMessage(); as message) {
        <app-form-banner [variant]="bannerVariant()!" [message]="message" />
      }

      <form class="form-grid" (ngSubmit)="onSubmit()">
        <div class="form-row-2">
          <app-form-field
            label="Имя"
            inputId="settings-first-name"
            name="first_name"
            autocomplete="given-name"
            [required]="true"
            [(value)]="firstName"
          />
          <app-form-field
            label="Фамилия"
            inputId="settings-last-name"
            name="last_name"
            autocomplete="family-name"
            [required]="true"
            [(value)]="lastName"
          />
        </div>
        <app-form-field
          label="Должность"
          inputId="settings-position"
          name="position"
          autocomplete="organization-title"
          [required]="true"
          [(value)]="position"
        />
        <app-form-field
          label="Email"
          inputId="settings-email"
          name="email"
          type="email"
          autocomplete="email"
          [disabled]="true"
          [value]="email"
        />
        <app-button variant="primary" type="submit" [disabled]="loading() || !isDirty()">
          {{ loading() ? 'Сохранение…' : 'Сохранить профиль' }}
        </app-button>
      </form>
    </app-settings-section>
  `,
  styleUrl: './profile-settings-organism.component.scss',
})
export class ProfileSettingsOrganismComponent {
  readonly user = input.required<UserPublic>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly success = input(false);
  readonly saved = output<UpdateProfileRequest>();

  protected firstName = '';
  protected lastName = '';
  protected position = '';
  protected email = '';

  private readonly localError = signal<string | null>(null);

  protected readonly isDirty = computed(() => {
    const user = this.user();
    return (
      this.firstName.trim() !== user.first_name ||
      this.lastName.trim() !== user.last_name ||
      this.position.trim() !== user.position
    );
  });

  protected readonly bannerVariant = computed<'error' | 'success' | null>(() => {
    if (this.localError() || this.error()) return 'error';
    if (this.success()) return 'success';
    return null;
  });

  protected readonly bannerMessage = computed(() => {
    if (this.localError()) return this.localError();
    if (this.error()) return this.error();
    if (this.success()) return 'Профиль сохранён';
    return null;
  });

  constructor() {
    effect(() => {
      const user = this.user();
      this.firstName = user.first_name;
      this.lastName = user.last_name;
      this.position = user.position;
      this.email = user.email;
      this.localError.set(null);
    });
  }

  onSubmit(): void {
    this.localError.set(null);

    const first_name = this.firstName.trim();
    const last_name = this.lastName.trim();
    const position = this.position.trim();

    if (!first_name || !last_name || !position) {
      this.localError.set('Заполните все обязательные поля');
      return;
    }

    if (!this.isDirty()) return;

    this.saved.emit({ first_name, last_name, position });
  }
}

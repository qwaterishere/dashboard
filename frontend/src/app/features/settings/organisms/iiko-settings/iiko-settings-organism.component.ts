import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import type {
  IikoSettingsPublic,
  UpdateIikoSettingsRequest,
} from '../../../../shared/models/iiko-settings.model';
import { isAllowlistedIikoHost, isValidHttpUrl, normalizeIikoUrl } from '../../../../shared/utils/iiko-settings.utils';
import {
  buildSyncProgressLabel,
  buildSyncStatusText,
  resolveSyncProgressPercent,
} from '../../../../shared/utils/iiko-sync.utils';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { ProgressFillComponent } from '../../../../ui/atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../../../ui/atoms/progress-track/progress-track.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { FormBannerComponent } from '../../../../ui/molecules/form-banner/form-banner.component';
import { FormFieldComponent } from '../../../../ui/molecules/form-field/form-field.component';
import { SettingsSectionComponent } from '../../../../ui/molecules/settings-section/settings-section.component';

@Component({
  selector: 'app-iiko-settings-organism',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonComponent,
    ProgressFillComponent,
    ProgressTrackComponent,
    TextComponent,
    FormBannerComponent,
    FormFieldComponent,
    SettingsSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-settings-section
      title="Подключение iiko"
      description="Данные кассы привязаны к вашему аккаунту. Пароль хранится зашифрованным и не отображается после сохранения."
    >
      @if (settingsLoading()) {
        <app-text tone="muted">Загрузка настроек подключения…</app-text>
      } @else if (settingsLoadError()) {
        <app-form-banner variant="error" message="Не удалось загрузить настройки iiko" />
      } @else {
        @if (bannerMessage(); as message) {
          <app-form-banner [variant]="bannerVariant()!" [message]="message" />
        }

        @if (settings()?.configured) {
          <app-text tone="muted">
            Подключение активно · ресторан {{ settings()!.restaurant_id }}
            @if (settings()?.updated_at; as updated) {
              · обновлено {{ updated | date: 'dd.MM.yyyy HH:mm' }}
            }
          </app-text>
        }

        <form class="form-grid" (ngSubmit)="onSubmit()">
          <app-form-field
            label="URL сервера iiko"
            inputId="settings-iiko-url"
            name="iiko_url"
            type="text"
            placeholder="https://example.iiko.it:443"
            autocomplete="off"
            [required]="true"
            [(value)]="iikoUrl"
          />
          <app-form-field
            label="Логин API-пользователя"
            inputId="settings-iiko-login"
            name="iiko_login"
            type="text"
            autocomplete="off"
            [required]="true"
            [(value)]="iikoLogin"
          />
          <app-form-field
            label="Пароль API-пользователя"
            inputId="settings-iiko-password"
            name="iiko_password"
            type="password"
            autocomplete="new-password"
            [placeholder]="passwordPlaceholder()"
            [required]="!settings()?.configured"
            [(value)]="iikoPassword"
          />
          <app-button variant="primary" type="submit" [disabled]="loading() || !canSubmit()">
            {{ loading() ? 'Проверка…' : 'Сохранить подключение' }}
          </app-button>
        </form>

        @if (settings()?.configured) {
          <div class="sync-block">
            <div class="sync-status">
              @if (isSyncRunning()) {
                <div
                  class="sync-progress"
                  role="status"
                  aria-live="polite"
                  [attr.aria-busy]="true"
                >
                  <div class="sync-progress__meta">
                    <app-text tone="muted">{{ syncProgressPercent() }}%</app-text>
                  </div>
                  <app-progress-track
                    variant="bar"
                    class="sync-progress__track"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="syncProgressPercent()"
                    [attr.aria-label]="syncProgressLabel()"
                  >
                    <app-progress-fill [width]="syncProgressPercent()" />
                  </app-progress-track>
                  <app-text tone="muted">{{ syncProgressLabel() }}</app-text>
                </div>
              } @else if (syncStatusText()) {
                <app-text tone="muted">{{ syncStatusText() }}</app-text>
              }
            </div>
            <div class="sync-actions">
              <app-button
                variant="default"
                type="button"
                [disabled]="isSyncRunning()"
                (pressed)="syncRequested.emit()"
              >
                {{ isSyncRunning() ? 'Загрузка…' : 'Догрузить новые дни' }}
              </app-button>
              <app-button
                variant="pill"
                type="button"
                [disabled]="isSyncRunning()"
                (pressed)="onResyncClick()"
              >
                Скачать заново
              </app-button>
            </div>
            <app-text tone="muted" class="sync-hint">
              «Догрузить» подтягивает дни с последней выгрузки. «Скачать заново» перезапишет всю
              историю с {{ historyFromLabel() }} — может занять несколько минут.
            </app-text>
            <div class="sync-feedback">
              @if (syncError()) {
                <app-form-banner variant="error" [message]="syncError()!" />
              } @else if (syncSuccess()) {
                <app-form-banner variant="success" message="Данные успешно загружены" />
              }
            </div>
          </div>
        }
      }
    </app-settings-section>
  `,
  styleUrl: './iiko-settings-organism.component.scss',
})
export class IikoSettingsOrganismComponent {
  readonly settings = input<IikoSettingsPublic | null>(null);
  readonly settingsLoading = input(false);
  readonly settingsLoadError = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly success = input(false);
  readonly syncLoading = input(false);
  readonly syncError = input<string | null>(null);
  readonly syncSuccess = input(false);
  readonly saved = output<UpdateIikoSettingsRequest>();
  readonly syncRequested = output<void>();
  readonly resyncRequested = output<void>();

  protected iikoUrl = '';
  protected iikoLogin = '';
  protected iikoPassword = '';

  private readonly localError = signal<string | null>(null);

  protected readonly passwordPlaceholder = computed(() =>
    this.settings()?.configured ? 'Оставьте пустым, чтобы не менять' : '',
  );

  protected readonly isSyncRunning = computed(
    () => this.syncLoading() || this.settings()?.sync?.status === 'running',
  );

  protected readonly syncProgressPercent = computed(() =>
    resolveSyncProgressPercent(this.settings()?.sync, this.syncLoading()),
  );

  protected readonly syncProgressLabel = computed(() =>
    buildSyncProgressLabel(this.settings()?.sync),
  );

  protected readonly syncStatusText = computed(() =>
    buildSyncStatusText(this.settings()?.sync, {
      hidePersistedError: !!this.syncError(),
    }),
  );

  /** Подпись нижней границы полной перезагрузки (как history_limit на бэкенде). */
  protected readonly historyFromLabel = computed(() => {
    const year = new Date().getFullYear() - 1;
    return `1 января ${year}`;
  });

  protected onResyncClick(): void {
    if (this.isSyncRunning()) return;
    const ok = confirm(
      `Перезагрузить все продажи с ${this.historyFromLabel()}? Текущие данные за этот период будут заменены.`,
    );
    if (ok) {
      this.resyncRequested.emit();
    }
  }

  protected isDirty(): boolean {
    const current = this.settings();
    const url = this.iikoUrl.trim();
    const login = this.iikoLogin.trim();
    const password = this.iikoPassword.trim();

    if (!current?.configured) {
      return !!(url || login || password);
    }

    return (
      url !== (current.iiko_url ?? '') ||
      login !== (current.iiko_login ?? '') ||
      password !== ''
    );
  }

  protected canSubmit(): boolean {
    const url = this.iikoUrl.trim();
    const login = this.iikoLogin.trim();
    if (!url || !login) return false;
    if (!this.settings()?.configured && !this.iikoPassword.trim()) return false;
    return this.isDirty();
  }

  protected readonly bannerVariant = computed<'error' | 'success' | null>(() => {
    if (this.localError() || this.error()) return 'error';
    if (this.success()) return 'success';
    return null;
  });

  protected readonly bannerMessage = computed(() => {
    if (this.localError()) return this.localError();
    if (this.error()) return this.error();
    if (this.success()) return 'Подключение iiko сохранено';
    return null;
  });

  constructor() {
    effect(() => {
      const current = this.settings();
      this.iikoUrl = current?.iiko_url ?? '';
      this.iikoLogin = current?.iiko_login ?? '';
      this.iikoPassword = '';
      this.localError.set(null);
    });

    effect(() => {
      if (this.error()) {
        this.localError.set(null);
      }
    });
  }

  onSubmit(): void {
    this.localError.set(null);

    const iiko_url = normalizeIikoUrl(this.iikoUrl);
    const iiko_login = this.iikoLogin.trim();
    const iiko_password = this.iikoPassword;

    if (!iiko_url || !iiko_login) {
      this.localError.set('Укажите URL и логин iiko');
      return;
    }

    if (!isValidHttpUrl(iiko_url)) {
      this.localError.set('Укажите корректный URL (https://)');
      return;
    }

    if (!isAllowlistedIikoHost(iiko_url)) {
      this.localError.set('Разрешены только хосты iiko (например, *.iiko.it)');
      return;
    }

    if (!this.settings()?.configured && !iiko_password.trim()) {
      this.localError.set('Укажите пароль для первичного подключения');
      return;
    }

    if (!this.isDirty()) return;

    this.saved.emit({ iiko_url, iiko_login, iiko_password });
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { TargetsRepository } from '../../../../core/data/targets.repository';
import { TargetsDataStore } from '../../../targets/data/targets-data.store';
import type { TargetsLockedPeriod } from '../../../../shared/models/targets.model';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { ConfirmDialogComponent } from '../../../../ui/molecules/confirm-dialog/confirm-dialog.component';
import { FormBannerComponent } from '../../../../ui/molecules/form-banner/form-banner.component';
import { SettingsSectionComponent } from '../../../../ui/molecules/settings-section/settings-section.component';

@Component({
  selector: 'app-targets-lock-settings-organism',
  standalone: true,
  imports: [
    ButtonComponent,
    TextComponent,
    ConfirmDialogComponent,
    FormBannerComponent,
    SettingsSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-settings-section
      title="Блокировка целей"
      description="Заблокированные месяцы нельзя редактировать на странице «Цели». Разблокировка — только здесь."
    >
      @if (loadError(); as err) {
        <app-form-banner variant="error" [message]="err" />
      }
      @if (success(); as msg) {
        <app-form-banner variant="success" [message]="msg" />
      }
      @if (actionError(); as err) {
        <app-form-banner variant="error" [message]="err" />
      }

      @if (loading()) {
        <app-text tone="muted">Загрузка…</app-text>
      } @else if (items().length === 0) {
        <app-text tone="muted">Нет заблокированных месяцев.</app-text>
      } @else {
        <ul class="locks">
          @for (item of items(); track item.year + '-' + item.month) {
            <li class="locks__row">
              <div class="locks__meta">
                <span class="locks__label">{{ item.label }}</span>
                <app-text tone="muted">редактирование закрыто</app-text>
              </div>
              <app-button
                variant="pill"
                [disabled]="busyKey() === lockKey(item)"
                (pressed)="requestUnlock(item)"
              >
                {{ busyKey() === lockKey(item) ? 'Разблокировка…' : 'Разблокировать' }}
              </app-button>
            </li>
          }
        </ul>
      }
    </app-settings-section>

    @if (unlockConfirm(); as item) {
      <app-confirm-dialog
        title="Разблокировать цели?"
        [message]="
          'Разблокировать цели за ' +
          item.label +
          '? После этого месяц снова можно будет редактировать на странице «Цели».'
        "
        confirmLabel="Разблокировать"
        cancelLabel="Отмена"
        confirmVariant="danger"
        (confirmed)="confirmUnlock()"
        (cancelled)="unlockConfirm.set(null)"
      />
    }
  `,
  styles: `
    .locks {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }

    .locks__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--card2);
    }

    .locks__meta {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .locks__label {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--txt);
    }

    @media (max-width: 520px) {
      .locks__row {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `,
})
export class TargetsLockSettingsOrganismComponent implements OnInit {
  private readonly repository = inject(TargetsRepository);
  private readonly targetsStore = inject(TargetsDataStore);

  protected readonly loading = signal(true);
  protected readonly items = signal<TargetsLockedPeriod[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly busyKey = signal<string | null>(null);
  protected readonly unlockConfirm = signal<TargetsLockedPeriod | null>(null);

  ngOnInit(): void {
    void this.reload();
  }

  lockKey(item: TargetsLockedPeriod): string {
    return `${item.year}-${item.month}`;
  }

  requestUnlock(item: TargetsLockedPeriod): void {
    this.unlockConfirm.set(item);
  }

  async confirmUnlock(): Promise<void> {
    const item = this.unlockConfirm();
    this.unlockConfirm.set(null);
    if (!item) return;

    this.busyKey.set(this.lockKey(item));
    this.actionError.set(null);
    this.success.set(null);
    try {
      await this.targetsStore.unlockMonth(item.year, item.month);
      this.success.set(`Цели за ${item.label} разблокированы`);
      await this.reload();
    } catch (err) {
      this.actionError.set(
        err instanceof HttpErrorResponse
          ? 'Не удалось разблокировать цели'
          : 'Не удалось разблокировать цели',
      );
    } finally {
      this.busyKey.set(null);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const data = await firstValueFrom(this.repository.listLocks());
      this.items.set(data.items);
    } catch {
      this.loadError.set('Не удалось загрузить список блокировок');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

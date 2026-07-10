import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { UserPublic } from '../../../../shared/models/auth.model';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { SettingsSectionComponent } from '../../../../ui/molecules/settings-section/settings-section.component';

@Component({
  selector: 'app-account-info-organism',
  standalone: true,
  imports: [TextComponent, SettingsSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-settings-section title="Аккаунт" description="Служебная информация о вашем доступе.">
      <dl class="meta">
        <div class="meta__row">
          <dt><app-text tone="muted">ID</app-text></dt>
          <dd><app-text>{{ user().id }}</app-text></dd>
        </div>
        <div class="meta__row">
          <dt><app-text tone="muted">Создан</app-text></dt>
          <dd><app-text>{{ createdLabel() }}</app-text></dd>
        </div>
      </dl>
    </app-settings-section>
  `,
  styles: `
    .meta {
      display: grid;
      gap: 10px;
      margin: 0;
    }

    .meta__row {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 12px;
      align-items: baseline;
    }

    dt,
    dd {
      margin: 0;
    }

    @media (max-width: 520px) {
      .meta__row {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
  `,
})
export class AccountInfoOrganismComponent {
  readonly user = input.required<UserPublic>();

  protected readonly createdLabel = computed(() =>
    new Date(this.user().created_at).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );
}

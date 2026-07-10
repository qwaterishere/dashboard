import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-settings-layout-template',
  standalone: true,
  imports: [TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-page': 'settings' },
  template: `
    <div class="settings">
      <app-text tone="muted" class="settings__lead">Профиль и безопасность аккаунта</app-text>
      <div class="settings__content">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .settings {
      display: grid;
      gap: 16px;
      max-width: 720px;
      padding-bottom: 32px;
    }

    .settings__lead {
      margin-top: -4px;
    }

    .settings__content {
      display: grid;
      gap: 16px;
    }
  `,
})
export class SettingsLayoutTemplateComponent {}

import { Component } from '@angular/core';

import { PlaceholderLayoutTemplateComponent } from '../../../../ui/templates/placeholder-layout/placeholder-layout-template.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [PlaceholderLayoutTemplateComponent],
  template: `
    <app-placeholder-layout-template
      title="Настройки"
      message="Персональные настройки и интеграции будут доступны после подключения auth."
    />
  `,
})
export class SettingsPageComponent {}

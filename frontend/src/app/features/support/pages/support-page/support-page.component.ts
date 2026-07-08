import { Component } from '@angular/core';

import { PlaceholderLayoutTemplateComponent } from '../../../../ui/templates/placeholder-layout/placeholder-layout-template.component';

@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [PlaceholderLayoutTemplateComponent],
  template: `
    <app-placeholder-layout-template
      title="Поддержка"
      message="Контакты службы поддержки и база знаний появятся здесь."
      hint="По срочным вопросам обращайтесь к администратору сети."
    />
  `,
})
export class SupportPageComponent {}

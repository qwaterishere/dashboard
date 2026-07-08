import { Component } from '@angular/core';

import { PlaceholderLayoutTemplateComponent } from '../../../../ui/templates/placeholder-layout/placeholder-layout-template.component';

@Component({
  selector: 'app-purchases-page',
  standalone: true,
  imports: [PlaceholderLayoutTemplateComponent],
  template: `
    <app-placeholder-layout-template
      title="Закупки"
      message="Модуль закупок появится в следующем релизе."
      hint="Пока используйте разделы Продажи, Склад и Фудкост."
    />
  `,
})
export class PurchasesPageComponent {}

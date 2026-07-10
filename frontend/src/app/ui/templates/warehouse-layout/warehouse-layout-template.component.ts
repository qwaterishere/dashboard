import { Component } from '@angular/core';

@Component({
  selector: 'app-warehouse-layout-template',
  standalone: true,
  host: { class: 'page-warehouse' },
  template: `<ng-content />`,
  styles: `:host { display: block; }`,
})
export class WarehouseLayoutTemplateComponent {}

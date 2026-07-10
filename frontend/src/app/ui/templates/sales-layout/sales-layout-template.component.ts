import { Component } from '@angular/core';

@Component({
  selector: 'app-sales-layout-template',
  standalone: true,
  host: { class: 'page-sales' },
  template: `<ng-content />`,
  styles: `:host { display: block; }`,
})
export class SalesLayoutTemplateComponent {}

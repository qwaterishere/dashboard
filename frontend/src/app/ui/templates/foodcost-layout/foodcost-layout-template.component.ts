import { Component } from '@angular/core';

@Component({
  selector: 'app-foodcost-layout-template',
  standalone: true,
  host: { 'data-page': 'foodcost' },
  template: `<ng-content />`,
  styles: `:host { display: block; }`,
})
export class FoodcostLayoutTemplateComponent {}

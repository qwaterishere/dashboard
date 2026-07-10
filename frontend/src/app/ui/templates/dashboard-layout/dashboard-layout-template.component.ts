import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-layout-template',
  standalone: true,
  template: `<ng-content />`,
  styles: `:host { display: block; }`,
})
export class DashboardLayoutTemplateComponent {}

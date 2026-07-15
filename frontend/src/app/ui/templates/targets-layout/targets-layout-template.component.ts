import { Component } from '@angular/core';

@Component({
  selector: 'app-targets-layout-template',
  standalone: true,
  host: { class: 'page-targets' },
  template: `<ng-content />`,
  styles: `:host { display: block; }`,
})
export class TargetsLayoutTemplateComponent {}

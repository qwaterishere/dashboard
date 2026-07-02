import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../atoms/heading/heading.component';

@Component({
  selector: 'app-panel-header',
  standalone: true,
  imports: [HeadingComponent],
  template: `
    <div class="p-head">
      <app-heading [level]="3" [text]="title()" />
      <div class="sp">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .p-head {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .sp {
      margin-left: auto;
      display: flex;
      gap: 8px;
    }
  `,
})
export class PanelHeaderComponent {
  readonly title = input.required<string>();
}

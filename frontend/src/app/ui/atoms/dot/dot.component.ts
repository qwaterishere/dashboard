import { Component, input } from '@angular/core';

@Component({
  selector: 'app-dot',
  standalone: true,
  template: `<span class="dot" [style.background]="color()"></span>`,
  styles: `
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex: none;
      display: inline-block;
    }
  `,
})
export class DotComponent {
  readonly color = input('#3DDC97');
}

import { Component, input } from '@angular/core';

@Component({
  selector: 'app-progress-track',
  standalone: true,
  template: `
    <div [class]="classes()">
      <ng-content />
    </div>
  `,
  styles: `
    .track {
      border-radius: 99px;
      background: #1b2236;
      overflow: hidden;
      position: relative;
    }
    .track--goal { height: 6px; }
    .track--bar { height: 7px; }
    .track--fc { height: 8px; overflow: visible; }
    .track--rev { height: 9px; display: flex; gap: 2px; background: #1b2236; }
  `,
})
export class ProgressTrackComponent {
  readonly variant = input<'goal' | 'bar' | 'fc' | 'rev'>('bar');

  classes(): string {
    return `track track--${this.variant()}`;
  }
}

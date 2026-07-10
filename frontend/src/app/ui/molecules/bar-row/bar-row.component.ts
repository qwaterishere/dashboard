import { Component, input } from '@angular/core';

@Component({
  selector: 'app-bar-row',
  standalone: true,
  template: `
    <div class="bar-row">
      <span class="br-name">{{ name() }}</span>
      <span class="br-track" [class.br-track--dual]="variant() === 'dual-rev-gp'">
        @if (variant() === 'dual-rev-gp') {
          <i class="br-rev" [style.width.%]="revWidth()"></i>
          <i class="br-gp" [style.width.%]="gpWidth()"></i>
        } @else {
          <i [style.width.%]="widthPct()"></i>
        }
      </span>
      <span class="br-vals">
        <ng-content />
      </span>
    </div>
  `,
  styleUrl: './bar-row.component.scss',
})
export class BarRowComponent {
  readonly name = input.required<string>();
  readonly variant = input<'single' | 'dual-rev-gp'>('single');
  readonly widthPct = input(0);
  readonly revWidth = input(0);
  readonly gpWidth = input(0);
}

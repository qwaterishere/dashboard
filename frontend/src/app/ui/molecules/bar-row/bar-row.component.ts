import { Component, input } from '@angular/core';

@Component({
  selector: 'app-bar-row',
  standalone: true,
  template: `
    @if (variant() === 'dual-rev-gp') {
      <div class="bar-row bar-row--dual">
        <div class="br-meta">
          <span class="br-name" [title]="name()">{{ name() }}</span>
          <div class="br-vals">
            <b class="br-r">{{ revLabel() }}</b>
            <b class="br-g">{{ gpLabel() }}</b>
            @if (shareLabel()) {
              <small>{{ shareLabel() }}</small>
            }
          </div>
        </div>
        <span class="br-track br-track--dual">
          <i class="br-rev" [style.width.%]="revWidth()"></i>
          <i class="br-gp" [style.width.%]="gpWidth()"></i>
        </span>
      </div>
    } @else {
      <div class="bar-row">
        <span class="br-name" [title]="name()">{{ name() }}</span>
        <span class="br-track">
          <i [style.width.%]="widthPct()"></i>
        </span>
        <span class="br-vals">
          <ng-content />
        </span>
      </div>
    }
  `,
  styleUrl: './bar-row.component.scss',
})
export class BarRowComponent {
  readonly name = input.required<string>();
  readonly variant = input<'single' | 'dual-rev-gp'>('single');
  readonly widthPct = input(0);
  readonly revWidth = input(0);
  readonly gpWidth = input(0);
  /** Подписи для dual-режима (форматируются снаружи pipes). */
  readonly revLabel = input('');
  readonly gpLabel = input('');
  readonly shareLabel = input('');
}

import {
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { PopoverController } from '../../../core/state/popover.controller';

@Component({
  selector: 'app-detail-popover-organism',
  standalone: true,
  template: `
    @if (state(); as pop) {
      <div
        #root
        class="kpop"
        [class.day]="pop.variant === 'day'"
        [class.show]="positioned()"
        [style.left.px]="left()"
        [style.top.px]="top()"
        [style.--ax.px]="arrowX()"
        (mouseenter)="popovers.cancelHide()"
        (mouseleave)="popovers.scheduleHide()"
        (click)="$event.stopPropagation()"
      >
        <h5>{{ pop.detail.title }}</h5>
        @for (row of pop.detail.rows; track $index) {
          <div class="pr">
            <span>{{ row[0] }}</span>
            <b [class.up]="row[2] === 'up'" [class.dn]="row[2] === 'dn'">{{ row[1] }}</b>
          </div>
        }
        <div class="ft">{{ pop.detail.footnote }}</div>
      </div>
    }
  `,
  styleUrl: './detail-popover-organism.component.scss',
})
export class DetailPopoverOrganismComponent {
  protected readonly popovers = inject(PopoverController);
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  protected readonly state = this.popovers.active;
  protected readonly left = signal(0);
  protected readonly top = signal(0);
  protected readonly arrowX = signal(28);
  protected readonly positioned = signal(false);

  constructor() {
    afterNextRender(() => {
      effect(() => {
        const pop = this.state();
        if (!pop) {
          this.positioned.set(false);
          return;
        }

        queueMicrotask(() => this.layout(pop));
      });
    });
  }

  private layout(pop: NonNullable<ReturnType<typeof this.state>>): void {
    const el = this.root()?.nativeElement;
    if (!el) return;

    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    const rect = pop.anchor;
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));

    const top = pop.placement === 'below' ? rect.bottom + 9 : rect.top - ph - 11;

    this.left.set(left);
    this.top.set(top);
    this.arrowX.set(rect.left + rect.width / 2 - left - 5);
    this.positioned.set(true);
  }
}

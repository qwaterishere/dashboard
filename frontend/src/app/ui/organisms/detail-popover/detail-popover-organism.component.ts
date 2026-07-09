import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PopoverController } from '../../../core/state/popover.controller';
import type { PopoverState } from '../../../core/state/popover.controller';

@Component({
  selector: 'app-detail-popover-organism',
  standalone: true,
  imports: [RouterLink],
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
        @if (pop.detail.footnoteLink) {
          <a
            class="ft link"
            [routerLink]="pop.detail.footnoteLink"
            [queryParams]="pop.detail.footnoteQueryParams ?? {}"
            (click)="popovers.hide()"
          >
            {{ pop.detail.footnote }}
          </a>
        } @else {
          <div class="ft">{{ pop.detail.footnote }}</div>
        }
      </div>
    }
  `,
  styleUrl: './detail-popover-organism.component.scss',
})
export class DetailPopoverOrganismComponent {
  protected readonly popovers = inject(PopoverController);
  private readonly injector = inject(Injector);
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  protected readonly state = this.popovers.active;
  protected readonly left = signal(0);
  protected readonly top = signal(0);
  protected readonly arrowX = signal(28);
  protected readonly positioned = signal(false);

  constructor() {
    effect(() => {
      const pop = this.state();
      if (!pop) {
        this.positioned.set(false);
        return;
      }

      this.positioned.set(false);
      afterNextRender(
        () => this.layoutWhenReady(pop),
        { injector: this.injector },
      );
    });
  }

  private layoutWhenReady(pop: PopoverState, attempt = 0): void {
    if (this.state()?.key !== pop.key) return;

    const el = this.root()?.nativeElement;
    if (!el) {
      if (attempt < 5) {
        requestAnimationFrame(() => this.layoutWhenReady(pop, attempt + 1));
      }
      return;
    }

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

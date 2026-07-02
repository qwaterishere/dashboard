import { Directive, ElementRef, inject, input } from '@angular/core';

import { PopoverController } from '../../core/state/popover.controller';
import type { DetailPopover } from '../../shared/models';

@Directive({
  selector: '[appPopoverTrigger]',
  host: {
    '(mouseenter)': 'onEnter()',
    '(mouseleave)': 'onLeave()',
    '(click)': 'onClick($event)',
    '[style.cursor]': 'popoverKey() ? "pointer" : null',
  },
})
export class PopoverTriggerDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly popovers = inject(PopoverController);

  readonly popoverKey = input<string | undefined>(undefined, { alias: 'appPopoverTrigger' });
  readonly popoverDetails = input<Record<string, DetailPopover>>({});
  readonly popoverPlacement = input<'below' | 'above'>('below');

  onEnter(): void {
    this.open(false);
  }

  onLeave(): void {
    this.popovers.scheduleHide();
  }

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.open(true);
  }

  private open(toggle: boolean): void {
    const key = this.popoverKey();
    if (!key) return;

    const detail = this.popoverDetails()[key];
    if (!detail) return;

    const state = {
      key,
      detail,
      anchor: this.el.nativeElement.getBoundingClientRect(),
      placement: this.popoverPlacement(),
      variant: 'default' as const,
    };

    if (toggle) {
      this.popovers.toggle(state);
    } else {
      this.popovers.show(state);
    }
  }
}

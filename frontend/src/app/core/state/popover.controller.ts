import { Injectable, signal } from '@angular/core';

import type { DetailPopover } from '../../shared/models';

export type PopoverPlacement = 'below' | 'above';

export interface PopoverState {
  key: string;
  detail: DetailPopover;
  anchor: DOMRect;
  placement: PopoverPlacement;
  variant: 'default' | 'day';
}

@Injectable({ providedIn: 'root' })
export class PopoverController {
  readonly active = signal<PopoverState | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  show(state: PopoverState): void {
    this.clearHideTimer();
    this.active.set(state);
  }

  toggle(state: PopoverState): void {
    const current = this.active();
    if (current?.key === state.key) {
      this.hide();
      return;
    }
    this.show(state);
  }

  scheduleHide(delayMs = 160): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => this.hide(), delayMs);
  }

  cancelHide(): void {
    this.clearHideTimer();
  }

  hide(): void {
    this.clearHideTimer();
    this.active.set(null);
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}

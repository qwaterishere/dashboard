import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-compare-pill',
  standalone: true,
  template: `
    @if (interactive()) {
      <button
        type="button"
        class="cmp-pill cmp-pill--interactive"
        [attr.aria-expanded]="ariaExpanded()"
        [attr.aria-haspopup]="ariaHasPopup()"
        (click)="pressed.emit()"
      >
        <span class="cmp-pill__prefix">LfL: сравнение с</span>
        <b class="cmp-pill__value">{{ compareWith() }}</b>
        <span class="cmp-pill__chevron" aria-hidden="true">▾</span>
      </button>
    } @else {
      <div class="cmp-pill">
        <span class="cmp-pill__prefix">LfL: сравнение с</span>
        <b class="cmp-pill__value">{{ compareWith() }}</b>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }

    .cmp-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(110, 107, 255, 0.12);
      border: 1px solid rgba(110, 107, 255, 0.4);
      border-radius: 11px;
      padding: 7px 14px;
      font-size: 0.76rem;
      font-weight: 600;
      color: #a5a3ff;
      white-space: nowrap;
      width: 100%;
      height: var(--period-pill-height);
      min-height: var(--period-pill-height);
      box-sizing: border-box;
      overflow: hidden;
    }

    .cmp-pill--interactive {
      font-family: inherit;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s ease;
    }

    .cmp-pill--interactive:hover {
      border-color: rgba(110, 107, 255, 0.65);
    }

    .cmp-pill__prefix {
      flex: none;
    }

    .cmp-pill__value {
      flex: 1 1 0;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #c9c8ff;
      font-weight: 700;
    }

    .cmp-pill__chevron {
      margin-left: auto;
      font-size: 0.6rem;
      opacity: 0.7;
      flex: none;
    }
  `,
})
export class ComparePillComponent {
  readonly compareWith = input.required<string>();
  readonly interactive = input(false);
  readonly ariaExpanded = input<boolean | null>(null);
  readonly ariaHasPopup = input<string | null>(null);

  readonly pressed = output<void>();
}

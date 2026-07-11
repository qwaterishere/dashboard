import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-date-pill',
  standalone: true,
  template: `
    @if (interactive()) {
      <button
        type="button"
        class="date-pill date-pill--interactive"
        [attr.aria-expanded]="ariaExpanded()"
        [attr.aria-haspopup]="ariaHasPopup()"
        (click)="pressed.emit()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span class="date-pill__label">{{ label() }}</span>
        @if (note()) {
          <span class="date-pill__note">{{ note() }}</span>
        }
        <span class="date-pill__chevron" aria-hidden="true">▾</span>
      </button>
    } @else {
      <div class="date-pill">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span class="date-pill__label">{{ label() }}</span>
        @if (note()) {
          <span class="date-pill__note">{{ note() }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .date-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 11px;
      padding: 7px 14px;
      font-size: 0.78rem;
      font-weight: 600;
      min-width: 0;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    }

    .date-pill--interactive {
      font-family: inherit;
      color: inherit;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s ease;
    }

    .date-pill--interactive:hover {
      border-color: rgba(110, 107, 255, 0.45);
    }

    .date-pill__label {
      white-space: nowrap;
      flex-shrink: 0;
    }

    .date-pill__note {
      color: var(--mut2);
      font-size: 0.68rem;
      font-weight: 600;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .date-pill__chevron {
      margin-left: auto;
      font-size: 0.6rem;
      opacity: 0.7;
      flex: none;
    }

    svg {
      width: 14px;
      height: 14px;
      color: var(--mut);
      flex: none;
    }
  `,
})
export class DatePillComponent {
  readonly label = input.required<string>();
  readonly note = input('');
  readonly interactive = input(false);
  readonly ariaExpanded = input<boolean | null>(null);
  readonly ariaHasPopup = input<string | null>(null);

  readonly pressed = output<void>();
}

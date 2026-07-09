import { Component, input } from '@angular/core';

@Component({
  selector: 'app-date-pill',
  standalone: true,
  template: `
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

    svg { width: 14px; height: 14px; color: var(--mut); flex: none; }
  `,
})
export class DatePillComponent {
  readonly label = input.required<string>();
  readonly note = input('');
}

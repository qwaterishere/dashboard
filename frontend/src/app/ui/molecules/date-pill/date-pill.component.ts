import { Component, input } from '@angular/core';

import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-date-pill',
  standalone: true,
  imports: [TextComponent],
  template: `
    <div class="date-pill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <span>{{ label() }}</span>
      @if (note()) {
        <app-text tone="caption">{{ note() }}</app-text>
      }
    </div>
  `,
  styles: `
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
    }
    svg { width: 14px; height: 14px; color: var(--mut); flex: none; }
  `,
})
export class DatePillComponent {
  readonly label = input.required<string>();
  readonly note = input('');
}

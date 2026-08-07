import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type ThemeToggleVariant = 'pill' | 'icon';

/**
 * Molecule: theme control.
 * - pill — подпись «Светлая/Тёмная тема» (settings / demos)
 * - icon — компактная кнопка для chrome (profile tools)
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'icon') {
      <button
        type="button"
        class="icon-btn"
        [attr.aria-pressed]="isDark()"
        [attr.aria-label]="isDark() ? 'Включить светлую тему' : 'Включить тёмную тему'"
        (click)="toggled.emit()"
      >
        @if (isDark()) {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 14.5A8.5 8.5 0 1110.5 3a7 7 0 0010.5 11.5z" />
          </svg>
        }
      </button>
    } @else {
      <button type="button" class="mode" (click)="toggled.emit()" [attr.aria-pressed]="isDark()">
        <span class="sun" [class.on]="isDark()"></span>
        {{ isDark() ? 'Тёмная тема' : 'Светлая тема' }}
      </button>
    }
  `,
  styles: `
    .mode {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 0.72rem;
      color: var(--mut);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 99px;
      padding: 6px 12px;
      cursor: pointer;
      font-family: inherit;
    }

    .sun {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--mut2);
      transition: background 0.2s, box-shadow 0.2s;
    }

    .sun.on {
      background: var(--grn);
      box-shadow: 0 0 8px var(--grn);
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--mut);
      display: grid;
      place-items: center;
      padding: 0;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s, background 0.15s;

      &:hover {
        color: var(--txt);
        border-color: rgba(110, 107, 255, 0.45);
        background: var(--card2, var(--card));
      }

      &:focus-visible {
        outline: 2px solid var(--vio);
        outline-offset: 2px;
      }
    }

    .icon-btn svg {
      width: 15px;
      height: 15px;
    }
  `,
})
export class ThemeToggleComponent {
  readonly isDark = input(false);
  readonly variant = input<ThemeToggleVariant>('pill');
  readonly toggled = output<void>();
}

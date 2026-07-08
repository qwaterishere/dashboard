import { Component, computed, inject } from '@angular/core';

import { ThemeService } from '../../../core/state/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button type="button" class="mode" (click)="onToggle()" [attr.aria-pressed]="isDark()">
      <span class="sun" [class.on]="isDark()"></span>
      {{ isDark() ? 'Тёмная тема' : 'Светлая тема' }}
    </button>
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
  `,
})
export class ThemeToggleComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');

  onToggle(): void {
    this.themeService.toggle();
  }
}

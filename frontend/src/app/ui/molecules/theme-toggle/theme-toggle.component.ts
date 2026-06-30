import { Component } from '@angular/core';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <span class="mode"><span class="sun"></span> Тёмная тема</span>
  `,
  styles: `
    .mode {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 0.72rem;
      color: var(--mut);
      background: #11182a;
      border: 1px solid var(--line);
      border-radius: 99px;
      padding: 6px 12px;
    }
    .sun {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--grn);
      box-shadow: 0 0 8px var(--grn);
    }
  `,
})
export class ThemeToggleComponent {}

import { Component, input, output } from '@angular/core';

import { ButtonComponent } from '../../atoms/button/button.component';
import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-profile-block',
  standalone: true,
  imports: [ButtonComponent, TextComponent],
  template: `
    <div class="profile-wrap">
      <div class="profile">
        <div class="icon-btn" aria-hidden="true">
          <span class="ndot"></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 9a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
            <path d="M10 20a2 2 0 004 0" />
          </svg>
        </div>
        <div class="ava">{{ initials() }}</div>
        <div class="who">
          <b>{{ name() }}</b>
          <app-text tone="muted">{{ role() }}</app-text>
        </div>
      </div>
      @if (showLogout()) {
        <app-button class="logout" variant="pill" [block]="true" (pressed)="logout.emit()">Выйти</app-button>
      }
    </div>
  `,
  styles: `
    .profile-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 24px;
    }

    .profile {
      display: flex;
      align-items: center;
      gap: 11px;
      justify-content: flex-end;
    }

    .logout {
      width: 100%;
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--mut);
      display: grid;
      place-items: center;
      position: relative;
    }
    .icon-btn svg { width: 16px; height: 16px; }
    .ndot {
      position: absolute;
      top: 8px;
      right: 9px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--grn);
      box-shadow: 0 0 6px var(--grn);
    }
    .ava {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      flex: none;
      background: linear-gradient(135deg, var(--vio), var(--grn));
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 0.85rem;
      color: #0a0e18;
    }
    .who b { font-size: 0.84rem; display: block; }
    .who app-text { display: block; }
  `,
})
export class ProfileBlockComponent {
  readonly initials = input.required<string>();
  readonly name = input.required<string>();
  readonly role = input('');
  readonly showLogout = input(true);
  readonly logout = output<void>();
}

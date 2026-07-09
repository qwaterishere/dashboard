import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-auth-layout-template',
  standalone: true,
  imports: [RouterOutlet, RouterLink, TextComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <a routerLink="/auth/login" class="logo">СЕЗОНЫ<span>.</span></a>
          <app-text tone="muted">Аналитика ресторанной сети</app-text>
        </div>
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .auth-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px 16px;
      background:
        radial-gradient(circle at top right, rgba(110, 107, 255, 0.12), transparent 42%),
        radial-gradient(circle at bottom left, rgba(61, 220, 151, 0.1), transparent 38%),
        var(--bg);
    }

    .auth-card {
      width: min(100%, 420px);
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--card);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
      padding: 28px 28px 24px;
    }

    .auth-brand {
      display: grid;
      gap: 6px;
      margin-bottom: 22px;
    }

    .logo {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--txt);
      text-decoration: none;
    }

    .logo span {
      color: var(--grn);
    }
  `,
})
export class AuthLayoutTemplateComponent {}

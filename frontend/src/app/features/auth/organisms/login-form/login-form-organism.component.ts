import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { resolveAuthError } from '../../../../core/auth/auth-errors';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { FormFieldComponent } from '../../../../ui/molecules/form-field/form-field.component';

@Component({
  selector: 'app-login-form-organism',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonComponent,
    HeadingComponent,
    TextComponent,
    FormFieldComponent,
  ],
  template: `
    <app-heading [level]="2" text="Вход" />
    <app-text tone="muted" class="lead">Email и пароль от вашей учётной записи</app-text>

    @if (sessionExpired()) {
      <app-text tone="danger" class="banner">Сессия истекла. Войдите снова.</app-text>
    }
    @if (error()) {
      <app-text tone="danger" class="banner">{{ error() }}</app-text>
    }

    <form class="form" (ngSubmit)="submit()">
      <app-form-field
        label="Email"
        inputId="login-email"
        name="email"
        type="email"
        autocomplete="email"
        [required]="true"
        [(value)]="email"
      />
      <app-form-field
        label="Пароль"
        inputId="login-password"
        name="password"
        type="password"
        autocomplete="current-password"
        [required]="true"
        [(value)]="password"
      />
      <app-button variant="primary" type="submit" [disabled]="loading()">
        {{ loading() ? 'Вход…' : 'Войти' }}
      </app-button>
    </form>

    <p class="switch">
      <app-text tone="muted">Нет аккаунта?</app-text>
      <a routerLink="/auth/register">Зарегистрироваться</a>
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: 14px;
    }

    .lead {
      margin-top: -6px;
    }

    .banner {
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(255, 107, 107, 0.08);
      border: 1px solid rgba(255, 107, 107, 0.25);
    }

    .form {
      display: grid;
      gap: 14px;
      margin-top: 4px;
    }

    .switch {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 4px;
    }

    .switch a {
      color: var(--b);
      font-weight: 700;
      text-decoration: none;
    }
  `,
})
export class LoginFormOrganismComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sessionExpired = signal(
    this.route.snapshot.queryParamMap.get('reason') === 'session_expired',
  );

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(resolveAuthError(err));
      },
    });
  }
}

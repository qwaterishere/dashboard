import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { resolveAuthError } from '../../../../core/auth/auth-errors';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { FormFieldComponent } from '../../../../ui/molecules/form-field/form-field.component';

@Component({
  selector: 'app-register-form-organism',
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
    <app-heading [level]="2" text="Регистрация" />
    <app-text tone="muted" class="lead">Имя, должность и рабочий email</app-text>

    @if (error()) {
      <app-text tone="danger" class="banner">{{ error() }}</app-text>
    }

    <form class="form" (ngSubmit)="submit()">
      <div class="row2">
        <app-form-field
          label="Имя"
          inputId="register-first-name"
          name="first_name"
          autocomplete="given-name"
          [required]="true"
          [(value)]="firstName"
        />
        <app-form-field
          label="Фамилия"
          inputId="register-last-name"
          name="last_name"
          autocomplete="family-name"
          [required]="true"
          [(value)]="lastName"
        />
      </div>
      <app-form-field
        label="Должность"
        inputId="register-position"
        name="position"
        autocomplete="organization-title"
        [required]="true"
        [(value)]="position"
      />
      <app-form-field
        label="Email"
        inputId="register-email"
        name="email"
        type="email"
        autocomplete="email"
        [required]="true"
        [(value)]="email"
      />
      <app-form-field
        label="Пароль"
        inputId="register-password"
        name="password"
        type="password"
        autocomplete="new-password"
        [required]="true"
        [(value)]="password"
      />
      <app-text tone="caption">Минимум 8 символов</app-text>
      <app-button variant="primary" type="submit" [disabled]="loading()">
        {{ loading() ? 'Создание…' : 'Создать аккаунт' }}
      </app-button>
    </form>

    <p class="switch">
      <app-text tone="muted">Уже есть аккаунт?</app-text>
      <a routerLink="/auth/login">Войти</a>
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

    .row2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
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

    @media (max-width: 520px) {
      .row2 {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class RegisterFormOrganismComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected firstName = '';
  protected lastName = '';
  protected position = '';
  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  submit(): void {
    this.error.set(null);

    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    const position = this.position.trim();
    const email = this.email.trim();

    if (!firstName || !lastName || !position || !email) {
      this.error.set('Заполните все поля');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Пароль должен содержать минимум 8 символов');
      return;
    }

    this.loading.set(true);
    this.auth
      .register({
        email,
        password: this.password,
        first_name: firstName,
        last_name: lastName,
        position,
      })
      .subscribe({
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

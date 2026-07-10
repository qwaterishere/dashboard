import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { FormBannerComponent } from '../../../../ui/molecules/form-banner/form-banner.component';
import { FormFieldComponent } from '../../../../ui/molecules/form-field/form-field.component';

export interface LoginFormValue {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login-form-organism',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonComponent,
    HeadingComponent,
    TextComponent,
    FormBannerComponent,
    FormFieldComponent,
  ],
  template: `
    <app-heading [level]="2" text="Вход" />
    <app-text tone="muted" class="lead">Email и пароль от вашей учётной записи</app-text>

    @if (sessionExpired()) {
      <app-form-banner variant="error" message="Сессия истекла. Войдите снова." />
    }
    @if (error()) {
      <app-form-banner variant="error" [message]="error()!" />
    }

    <form class="form" (ngSubmit)="submitted.emit({ email: email.trim(), password })">
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
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly sessionExpired = input(false);
  readonly submitted = output<LoginFormValue>();

  protected email = '';
  protected password = '';
}

import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { resolveAuthError } from '../../../../core/auth/auth-errors';
import {
  RegisterFormOrganismComponent,
  type RegisterFormValue,
} from '../../organisms/register-form/register-form-organism.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [RegisterFormOrganismComponent],
  template: `
    <app-register-form-organism
      [loading]="loading()"
      [error]="error()"
      (submitted)="onSubmit($event)"
    />
  `,
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  onSubmit(value: RegisterFormValue): void {
    this.error.set(null);

    if (!value.firstName || !value.lastName || !value.position || !value.email) {
      this.error.set('Заполните все поля');
      return;
    }
    if (value.password.length < 8) {
      this.error.set('Пароль должен содержать минимум 8 символов');
      return;
    }

    this.loading.set(true);
    this.auth
      .register({
        email: value.email,
        password: value.password,
        first_name: value.firstName,
        last_name: value.lastName,
        position: value.position,
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

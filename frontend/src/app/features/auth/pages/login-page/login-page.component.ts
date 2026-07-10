import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { resolveAuthError } from '../../../../core/auth/auth-errors';
import {
  LoginFormOrganismComponent,
  type LoginFormValue,
} from '../../organisms/login-form/login-form-organism.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [LoginFormOrganismComponent],
  template: `
    <app-login-form-organism
      [loading]="loading()"
      [error]="error()"
      [sessionExpired]="sessionExpired()"
      (submitted)="onSubmit($event)"
    />
  `,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sessionExpired = signal(
    this.route.snapshot.queryParamMap.get('reason') === 'session_expired',
  );

  onSubmit(value: LoginFormValue): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(value).subscribe({
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

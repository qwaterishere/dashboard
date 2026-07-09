import { Component } from '@angular/core';

import { LoginFormOrganismComponent } from '../../organisms/login-form/login-form-organism.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [LoginFormOrganismComponent],
  template: `<app-login-form-organism />`,
})
export class LoginPageComponent {}

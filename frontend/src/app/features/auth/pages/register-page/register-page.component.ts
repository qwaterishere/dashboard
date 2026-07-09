import { Component } from '@angular/core';

import { RegisterFormOrganismComponent } from '../../organisms/register-form/register-form-organism.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [RegisterFormOrganismComponent],
  template: `<app-register-form-organism />`,
})
export class RegisterPageComponent {}

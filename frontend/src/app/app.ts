import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CurrencyService } from './core/state/currency.service';
import { ThemeService } from './core/state/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: `:host { display: block; height: 100vh; overflow: hidden; }`,
})
export class App {
  constructor() {
    inject(ThemeService);
    inject(CurrencyService);
  }
}

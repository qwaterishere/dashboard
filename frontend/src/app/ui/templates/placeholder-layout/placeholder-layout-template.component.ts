import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../atoms/heading/heading.component';
import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-placeholder-layout-template',
  standalone: true,
  imports: [HeadingComponent, TextComponent],
  template: `
    <section class="placeholder">
      <app-heading [level]="1" [text]="title()" />
      <app-text tone="muted">{{ message() }}</app-text>
      @if (hint()) {
        <app-text tone="caption">{{ hint() }}</app-text>
      }
    </section>
  `,
  styles: `
    .placeholder {
      display: grid;
      gap: 12px;
      max-width: 520px;
      padding: 8px 0 24px;
    }
  `,
})
export class PlaceholderLayoutTemplateComponent {
  readonly title = input.required<string>();
  readonly message = input('Раздел в разработке');
  readonly hint = input<string | undefined>(undefined);
}

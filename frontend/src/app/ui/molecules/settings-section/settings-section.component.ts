import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HeadingComponent } from '../../atoms/heading/heading.component';
import { TextComponent } from '../../atoms/text/text.component';

@Component({
  selector: 'app-settings-section',
  standalone: true,
  imports: [HeadingComponent, TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    '[attr.aria-label]': 'title()',
  },
  template: `
    <section class="section">
      <div class="section__head">
        <app-heading [level]="3" [text]="title()" />
        @if (description()) {
          <app-text tone="muted">{{ description() }}</app-text>
        }
      </div>
      <div class="section__body">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    .section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--r);
      padding: 20px 22px;
    }

    .section__head {
      display: grid;
      gap: 6px;
      margin-bottom: 16px;
    }

    .section__body {
      display: grid;
      gap: 14px;
    }
  `,
})
export class SettingsSectionComponent {
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
}

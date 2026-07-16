import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';

@Component({
  selector: 'app-target-section',
  standalone: true,
  imports: [ButtonComponent, HeadingComponent, TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    '[attr.aria-label]': 'title()',
  },
  template: `
    <section class="target-section">
      <header class="target-section__head">
        <span class="target-section__badge">{{ badge() }}</span>
        <div class="target-section__titles">
          <app-heading [level]="3" [text]="title()" />
          @if (description()) {
            <app-text tone="muted">{{ description() }}</app-text>
          }
        </div>
        @if (canReset()) {
          <app-button
            class="target-section__reset"
            variant="pill"
            (pressed)="resetRequested.emit()"
          >
            Сбросить
          </app-button>
        }
      </header>
      <div class="target-section__body">
        <ng-content />
      </div>
    </section>
  `,
  styleUrl: './target-section.component.scss',
})
export class TargetSectionComponent {
  readonly badge = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
  readonly canReset = input(false);

  readonly resetRequested = output<void>();
}

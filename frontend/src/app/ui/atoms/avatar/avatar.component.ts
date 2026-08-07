import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Atom: user initials avatar. */
@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="ava" aria-hidden="true">{{ initials() }}</div>`,
  styles: `
    .ava {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      flex: none;
      background: linear-gradient(135deg, var(--vio), var(--grn));
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 0.8rem;
      color: #0a0e18;
    }
  `,
})
export class AvatarComponent {
  readonly initials = input.required<string>();
}

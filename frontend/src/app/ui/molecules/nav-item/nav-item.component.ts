import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BadgeComponent } from '../../atoms/badge/badge.component';

@Component({
  selector: 'app-nav-item',
  standalone: true,
  imports: [RouterLink, BadgeComponent],
  template: `
    <a [routerLink]="path()" [class.on]="active()">
      {{ label() }}
      @if (badge()) {
        <app-badge [label]="badge()!" variant="nav" />
      }
    </a>
  `,
  styles: `
    a {
      display: flex;
      align-items: center;
      gap: 11px;
      color: var(--mut);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.86rem;
      padding: 10px 12px;
      border-radius: 10px;
      transition: all 0.15s;
    }
    a:hover { color: var(--txt); background: var(--nav-hover-bg); }
    a.on {
      color: var(--nav-active-fg);
      background: var(--nav-active-bg);
      box-shadow: var(--nav-active-ring);
    }
    a app-badge {
      margin-left: auto;
    }
  `,
})
export class NavItemComponent {
  readonly path = input.required<string>();
  readonly label = input.required<string>();
  readonly badge = input<string>();
  readonly active = input(false);
}

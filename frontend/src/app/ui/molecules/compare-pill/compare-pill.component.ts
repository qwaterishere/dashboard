import { Component, input } from '@angular/core';

@Component({
  selector: 'app-compare-pill',
  standalone: true,
  template: `
    <div class="cmp-pill">
      LfL: сравнение с <b>{{ compareWith() }}</b>
      <span class="x" aria-hidden="true">✕</span>
    </div>
  `,
  styles: `
    .cmp-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(110, 107, 255, 0.12);
      border: 1px solid rgba(110, 107, 255, 0.4);
      border-radius: 11px;
      padding: 7px 14px;
      font-size: 0.76rem;
      font-weight: 600;
      color: #a5a3ff;
    }
    b { color: #c9c8ff; }
    .x { margin-left: 4px; opacity: 0.6; cursor: pointer; }
  `,
})
export class ComparePillComponent {
  readonly compareWith = input.required<string>();
}

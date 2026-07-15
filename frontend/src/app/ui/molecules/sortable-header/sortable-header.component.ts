import { Component, computed, input, output } from '@angular/core';

export type SortableHeaderAlign = 'start' | 'center' | 'end';
export type SortableHeaderDirection = 'asc' | 'desc';

@Component({
  selector: 'app-sortable-header',
  standalone: true,
  template: `
    <button
      type="button"
      class="sortable-header"
      [class.sortable-header--active]="active()"
      [class.sortable-header--align-start]="align() === 'start'"
      [class.sortable-header--align-center]="align() === 'center'"
      [class.sortable-header--align-end]="align() === 'end'"
      [attr.aria-label]="ariaLabel()"
      (click)="activated.emit()"
    >
      <span class="sortable-header__label">{{ label() }}</span>
      <span class="sortable-header__icon" aria-hidden="true">
        @if (active()) {
          {{ direction() === 'desc' ? '▾' : '▴' }}
        }
      </span>
    </button>
  `,
  styleUrl: './sortable-header.component.scss',
})
export class SortableHeaderComponent {
  readonly label = input.required<string>();
  readonly align = input<SortableHeaderAlign>('end');
  readonly active = input(false);
  readonly direction = input<SortableHeaderDirection>('desc');

  readonly activated = output<void>();

  protected readonly ariaLabel = computed(() => {
    const label = this.label();
    if (!this.active()) {
      return `Сортировать по «${label}»`;
    }
    const order = this.direction() === 'desc' ? 'убыванию' : 'возрастанию';
    return `Сортировать по «${label}», по ${order}`;
  });
}

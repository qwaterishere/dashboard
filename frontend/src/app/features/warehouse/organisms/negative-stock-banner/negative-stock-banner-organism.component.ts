import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import type { WarehouseData, WarehousePosition } from '../../../../shared/models';
import { FmtPipe, MoneyPipe } from '../../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-negative-stock-banner-organism',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, FmtPipe],
  template: `
    <div class="neg" [class.neg--open]="open()">
      <button
        type="button"
        class="neg__banner"
        [attr.aria-expanded]="open()"
        aria-controls="neg-stock-detail"
        (click)="toggle()"
      >
        <span class="neg__summary">
          Минусовые остатки: {{ summary().count }} поз. · дыра
          {{ summary().valueAbs | money }}
        </span>
        <span class="neg__chevron" aria-hidden="true">{{ open() ? '▴' : '▾' }}</span>
      </button>

      @if (open()) {
        <div
          id="neg-stock-detail"
          class="neg__panel"
          role="region"
          aria-label="Минусовые позиции"
        >
          <ul class="neg__list">
            @for (row of rows(); track row.productId + row.store) {
              <li class="neg__row">
                <div class="neg__meta">
                  <span class="neg__name">{{ row.name }}</span>
                  <span class="neg__store">{{ storeLabel(row.store) }}</span>
                </div>
                <div class="neg__figures">
                  <span class="neg__qty">{{ row.qty | fmt }} {{ row.unit }}</span>
                  <b class="neg__value">{{ row.value | money }}</b>
                </div>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styleUrl: './negative-stock-banner-organism.component.scss',
})
export class NegativeStockBannerOrganismComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private didAutoOpen = false;

  readonly summary = input.required<WarehouseData['negativeStock']>();
  readonly positions = input.required<WarehousePosition[]>();
  /** Deep-link `/warehouse?focus=negative` — раскрыть список и проскроллить. */
  readonly initiallyOpen = input(false);

  protected readonly open = signal(false);

  protected readonly rows = computed(() =>
    this.positions()
      .filter((row) => row.qty < 0)
      .slice()
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.name.localeCompare(b.name, 'ru')),
  );

  constructor() {
    effect(() => {
      if (!this.initiallyOpen() || this.didAutoOpen) return;
      this.didAutoOpen = true;
      this.openDetail();
    });
  }

  storeLabel(store: WarehousePosition['store']): string {
    return CAT_NAME[store] ?? store;
  }

  openDetail(): void {
    this.open.set(true);
    afterNextRender(
      () => {
        this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  toggle(): void {
    this.open.update((value) => !value);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.open.set(false);
    }
  }
}

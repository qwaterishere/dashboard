import { Component, computed, input } from '@angular/core';

import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { PanelBusyOverlayComponent } from '../../../../ui/molecules/panel-busy-overlay/panel-busy-overlay.component';
import { DotComponent } from '../../../../ui/atoms/dot/dot.component';
import { KFormatPipe, MoneyPipe } from '../../../../shared/pipes/format.pipes';
import { CAT_COLOR } from '../../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../../shared/models';

@Component({
  selector: 'app-stock-panel-organism',
  standalone: true,
  imports: [PanelHeaderComponent, PanelBusyOverlayComponent, DotComponent, MoneyPipe, KFormatPipe],
  template: `
    <div class="panel panel-flat" [class.panel--loading]="loading()">
      <app-panel-header title="Остаток на складе" />
      <p class="r-cap">Стоимость запасов по складам</p>

      @if (stock(); as s) {
        <div class="stock-hero">
          <span class="st-sum">{{ s.total | money }}</span>
        </div>

        @if (rows().length) {
          <div
            class="stock-stack"
            role="img"
            [attr.aria-label]="'Структура остатка ' + (s.total | money)"
          >
            @for (row of rows(); track row.key) {
              <span
                class="stock-seg"
                [style.flex-grow]="row.value"
                [style.background]="row.color"
                [attr.title]="row.name + ': ' + (row.value | money)"
              ></span>
            }
          </div>

          <ul class="stock-rows">
            @for (row of rows(); track row.key) {
              <li class="stock-row">
                <app-dot [color]="row.color" />
                <span class="stock-row__name">{{ row.name }}</span>
                <span class="stock-row__val" [attr.title]="row.value | money">
                  {{ row.value | kFormat }}
                </span>
                <span class="stock-row__pct">{{ row.share }}%</span>
              </li>
            }
          </ul>
        } @else {
          <p class="stock-empty">Нет положительных остатков</p>
        }
      } @else if (!loading()) {
        <p class="stock-empty">Нет слепка остатков</p>
      }

      @if (loading()) {
        <app-panel-busy-overlay />
      }
    </div>
  `,
  styleUrl: './stock-panel-organism.component.scss',
})
export class StockPanelOrganismComponent {
  readonly stock = input<{
    total: number;
    items: { key: CategoryKey; name: string; value: number }[];
  } | null>(null);
  readonly loading = input(false);

  protected readonly rows = computed(() => {
    const data = this.stock();
    if (!data) return [];
    const total = data.total;
    return data.items
      .filter((item) => item.value > 0)
      .map((item) => ({
        key: item.key,
        name: item.name,
        value: item.value,
        color: CAT_COLOR[item.key],
        share: total ? Math.round((item.value / total) * 100) : 0,
      }));
  });
}

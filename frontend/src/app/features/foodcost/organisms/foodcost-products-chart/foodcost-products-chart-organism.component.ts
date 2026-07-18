import { DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { CurrencySymbolPipe, FmtPipe } from '../../../../shared/pipes/format.pipes';
import type { FoodcostProduct } from '../../../../shared/models';
import {
  buildProductChartBars,
  computeProductChartItems,
  type ProductChartBar,
  type ProductChartGroup,
} from '../../data/foodcost-products.utils';

type BarTone = 'good' | 'bad';

interface RankedBar extends ProductChartBar {
  key: string;
}

interface TooltipState {
  name: string;
  price: number;
  cost: number;
  margin: number;
  fc: number;
  left: number;
  top: number;
}

@Component({
  selector: 'app-foodcost-products-chart-organism',
  standalone: true,
  imports: [HeadingComponent, SegmentControlComponent, FmtPipe, CurrencySymbolPipe, DecimalPipe],
  template: `
    <div class="prodchart">
      <div class="catfc-head">
        <div>
          <app-heading [level]="2" text="Выгодность позиций по фудкосту" />
          <span class="losses-sub"
            >высота столбца — цена, закрашено — себестоимость, светлое сверху — наценка. Рейтинг
            по фудкост-проценту, не по марже в рублях.</span
          >
        </div>
        <div class="pc-controls">
          <app-segment-control size="sm" tone="foodcost" [options]="groupOptions" [(value)]="group" />
        </div>
      </div>

      <div class="pc-chart-wrap">
        <div class="pc-chart" #chartHost (mouseleave)="onChartLeave($event)">
          @if (ranked().good.length === 0 && ranked().bad.length === 0) {
            <p class="pc-empty">Нет позиций с техкартами за период</p>
          } @else {
            @for (bar of ranked().good; track bar.key) {
              <span
                class="pc-bar good"
                [class.is-active]="activeKey() === bar.key"
                [class.is-dimmed]="activeKey() !== null && activeKey() !== bar.key"
                (mouseenter)="activate($event, bar)"
                (mousemove)="moveTip($event, bar)"
                (mouseleave)="deactivate($event)"
              >
                <span class="pc-fc">{{ bar.fc | number: '1.0-0' }}%</span>
                <span class="pc-col" [style.height.px]="bar.columnHeight">
                  <span class="pc-cost" [style.height.px]="bar.costHeight"></span>
                </span>
              </span>
            }
            <div class="pc-divider"></div>
            @for (bar of ranked().bad; track bar.key) {
              <span
                class="pc-bar bad"
                [class.is-active]="activeKey() === bar.key"
                [class.is-dimmed]="activeKey() !== null && activeKey() !== bar.key"
                (mouseenter)="activate($event, bar)"
                (mousemove)="moveTip($event, bar)"
                (mouseleave)="deactivate($event)"
              >
                <span class="pc-fc">{{ bar.fc | number: '1.0-0' }}%</span>
                <span class="pc-col" [style.height.px]="bar.columnHeight">
                  <span class="pc-cost" [style.height.px]="bar.costHeight"></span>
                </span>
              </span>
            }
          }
        </div>

        @if (tip(); as t) {
          <div
            class="pc-tip"
            [style.left.px]="t.left"
            [style.top.px]="t.top"
            (mouseleave)="deactivate($event)"
          >
            <b>{{ t.name }}</b>
            <div class="row"><span>Цена</span><b>{{ t.price | fmt }} {{ '' | currencySymbol }}</b></div>
            <div class="row"><span>Себестоимость</span><b>{{ t.cost | fmt }} {{ '' | currencySymbol }}</b></div>
            <div class="row"><span>Наценка</span><b>{{ t.margin | fmt }} {{ '' | currencySymbol }}</b></div>
            <div class="row">
              <span>Фудкост</span><b>{{ t.fc | number: '1.1-1' }} %</b>
            </div>
          </div>
        }
      </div>

      @if (ranked().good.length > 0 || ranked().bad.length > 0) {
        <div class="pc-legend">
          <div class="pc-legend__col">
            <div class="pc-legend__title ok">Лучшие</div>
            <ol class="pc-legend__list">
              @for (bar of ranked().good; track bar.key) {
                <li
                  class="pc-legend__row good"
                  [class.is-active]="activeKey() === bar.key"
                  (mouseenter)="activateFromLegend(bar)"
                  (mouseleave)="clearActive()"
                >
                  <span class="pc-legend__rank">{{ $index + 1 }}</span>
                  <span class="pc-legend__name">{{ bar.name }}</span>
                  <span class="pc-legend__fc">{{ bar.fc | number: '1.0-0' }}%</span>
                </li>
              }
            </ol>
          </div>
          <div class="pc-legend__col">
            <div class="pc-legend__title bad">Худшие</div>
            <ol class="pc-legend__list">
              @for (bar of ranked().bad; track bar.key) {
                <li
                  class="pc-legend__row bad"
                  [class.is-active]="activeKey() === bar.key"
                  (mouseenter)="activateFromLegend(bar)"
                  (mouseleave)="clearActive()"
                >
                  <span class="pc-legend__rank">{{ $index + 1 }}</span>
                  <span class="pc-legend__name">{{ bar.name }}</span>
                  <span class="pc-legend__fc">{{ bar.fc | number: '1.0-0' }}%</span>
                </li>
              }
            </ol>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './foodcost-products-chart-organism.component.scss',
})
export class FoodcostProductsChartOrganismComponent {
  readonly products = input.required<FoodcostProduct[]>();
  readonly group = model<ProductChartGroup>('all');

  private readonly chartHost = viewChild<ElementRef<HTMLElement>>('chartHost');
  protected readonly tip = signal<TooltipState | null>(null);
  protected readonly activeKey = signal<string | null>(null);

  protected readonly groupOptions = [
    { value: 'all' as const, label: 'Всё' },
    ...(['k', 'b', 'w'] as const).map((key) => ({
      value: key,
      label: CAT_NAME[key],
    })),
  ];

  protected readonly items = computed(() => computeProductChartItems(this.products()));

  protected readonly ranked = computed(() => {
    const { good, bad } = buildProductChartBars(this.items(), this.group());
    return {
      good: good.map((bar, index) => this.withKey(bar, 'good', index)),
      bad: bad.map((bar, index) => this.withKey(bar, 'bad', index)),
    };
  });

  activate(event: MouseEvent, bar: RankedBar): void {
    this.activeKey.set(bar.key);
    this.tip.set(this.tipFromEvent(event, bar));
  }

  activateFromLegend(bar: RankedBar): void {
    this.activeKey.set(bar.key);
    this.tip.set(null);
  }

  moveTip(event: MouseEvent, bar: RankedBar): void {
    this.tip.set(this.tipFromEvent(event, bar));
  }

  deactivate(event?: MouseEvent): void {
    if (this.movesInto(event, '.pc-tip') || this.movesInto(event, '.pc-bar')) {
      return;
    }
    this.tip.set(null);
    this.activeKey.set(null);
  }

  onChartLeave(event: MouseEvent): void {
    this.deactivate(event);
  }

  clearActive(): void {
    this.activeKey.set(null);
  }

  private movesInto(event: MouseEvent | undefined, selector: string): boolean {
    const related = event?.relatedTarget;
    return related instanceof Element && related.closest(selector) !== null;
  }

  private withKey(bar: ProductChartBar, tone: BarTone, index: number): RankedBar {
    return { ...bar, key: `${bar.id ?? bar.name}-${tone}-${index}` };
  }

  private tipFromEvent(event: MouseEvent, bar: ProductChartBar): TooltipState {
    const host = this.chartHost()?.nativeElement.parentElement;
    const target = event.currentTarget as HTMLElement;
    const barRect = target.getBoundingClientRect();
    const wrapRect = host?.getBoundingClientRect() ?? barRect;

    return {
      name: bar.name,
      price: bar.price,
      cost: bar.cost,
      margin: bar.margin,
      fc: bar.fc,
      left: barRect.left - wrapRect.left + barRect.width / 2,
      top: barRect.top - wrapRect.top,
    };
  }
}

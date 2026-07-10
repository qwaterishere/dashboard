import { DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { FmtPipe } from '../../../../shared/pipes/format.pipes';
import type { FoodcostProduct } from '../../../../shared/models';
import {
  buildProductChartBars,
  computeProductChartItems,
  type ProductChartGroup,
} from '../../data/foodcost-products.utils';

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
  imports: [HeadingComponent, SegmentControlComponent, FmtPipe, DecimalPipe],
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

      <div class="pc-side-label">
        <span class="pcs ok">● 10 лучших — низкий фудкост</span>
        <span class="pcs bad">● 10 худших — высокий фудкост</span>
      </div>

      <div class="pc-chart-wrap">
        <div class="pc-chart" #chartHost (mouseleave)="hideTip()">
          @for (bar of bars().good; track bar.name) {
            <span
              class="pc-bar good"
              (mouseenter)="showTip($event, bar)"
              (mousemove)="moveTip($event, bar)"
            >
              <span class="pc-fc">{{ bar.fc | number: '1.0-0' }}%</span>
              <span class="pc-col" [style.height.px]="bar.columnHeight">
                <span class="pc-cost" [style.height.px]="bar.costHeight"></span>
              </span>
              <span class="pc-name">{{ bar.name }}</span>
            </span>
          }
          <div class="pc-divider"></div>
          @for (bar of bars().bad; track bar.name) {
            <span
              class="pc-bar bad"
              (mouseenter)="showTip($event, bar)"
              (mousemove)="moveTip($event, bar)"
            >
              <span class="pc-fc">{{ bar.fc | number: '1.0-0' }}%</span>
              <span class="pc-col" [style.height.px]="bar.columnHeight">
                <span class="pc-cost" [style.height.px]="bar.costHeight"></span>
              </span>
              <span class="pc-name">{{ bar.name }}</span>
            </span>
          }
        </div>

        @if (tip(); as t) {
          <div class="pc-tip" [style.left.px]="t.left" [style.top.px]="t.top">
            <b>{{ t.name }}</b>
            <div class="row"><span>Цена</span><b>{{ t.price | fmt }} ₽</b></div>
            <div class="row"><span>Себестоимость</span><b>{{ t.cost | fmt }} ₽</b></div>
            <div class="row"><span>Наценка</span><b>{{ t.margin | fmt }} ₽</b></div>
            <div class="row">
              <span>Фудкост</span><b>{{ t.fc | number: '1.1-1' }} %</b>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './foodcost-products-chart-organism.component.scss',
})
export class FoodcostProductsChartOrganismComponent {
  readonly products = input.required<FoodcostProduct[]>();
  readonly group = model<ProductChartGroup>('all');

  private readonly chartHost = viewChild<ElementRef<HTMLElement>>('chartHost');
  protected readonly tip = signal<TooltipState | null>(null);

  protected readonly groupOptions = [
    { value: 'all' as const, label: 'Всё' },
    ...(['k', 'b', 'w'] as const).map((key) => ({
      value: key,
      label: CAT_NAME[key],
    })),
  ];

  protected readonly items = computed(() => computeProductChartItems(this.products()));

  protected readonly bars = computed(() =>
    buildProductChartBars(this.items(), this.group()),
  );

  showTip(event: MouseEvent, bar: { name: string; price: number; cost: number; margin: number; fc: number }): void {
    this.tip.set(this.tipFromEvent(event, bar));
  }

  moveTip(event: MouseEvent, bar: { name: string; price: number; cost: number; margin: number; fc: number }): void {
    this.tip.set(this.tipFromEvent(event, bar));
  }

  hideTip(): void {
    this.tip.set(null);
  }

  private tipFromEvent(
    event: MouseEvent,
    bar: { name: string; price: number; cost: number; margin: number; fc: number },
  ): TooltipState {
    const host = this.chartHost()?.nativeElement.parentElement;
    const target = event.currentTarget as HTMLElement;
    const barRect = target.getBoundingClientRect();
    const wrapRect = host?.getBoundingClientRect() ?? barRect;

    return {
      ...bar,
      left: barRect.left - wrapRect.left + barRect.width / 2,
      top: barRect.top - wrapRect.top,
    };
  }
}

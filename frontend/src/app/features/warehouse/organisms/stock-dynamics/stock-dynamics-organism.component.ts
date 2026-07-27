import {
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import type { WarehouseDynamicsPoint, WarehouseStoreKey } from '../../../../shared/models/warehouse-api.model';
import { WarehousePeriodService } from '../../data/warehouse-period.service';
import {
  buildContinuousStockLayout,
  clampRangeEndDay,
  clampSpanDays,
  clientToSvgPoint,
  hitChartZone,
  isoToDayNumber,
  STOCK_CHART_HEIGHT,
  STOCK_CHART_PAD_LEFT,
  STOCK_CHART_PAD_RIGHT,
  STOCK_CHART_WIDTH,
  STOCK_DYNAMICS_DEFAULT_SPAN_DAYS,
} from '../../data/stock-dynamics.utils';

type StoreFilter = WarehouseStoreKey | 'all';
type DragMode = 'pan' | 'zoom';

@Component({
  selector: 'app-stock-dynamics-organism',
  standalone: true,
  imports: [HeadingComponent, TextComponent, SegmentControlComponent, ButtonComponent],
  templateUrl: './stock-dynamics-organism.component.html',
  styleUrl: './stock-dynamics-organism.component.scss',
})
export class StockDynamicsOrganismComponent {
  private readonly warehousePeriod = inject(WarehousePeriodService);

  readonly points = input.required<readonly WarehouseDynamicsPoint[]>();
  /** Верхняя граница оси / clamp (обычно dataBounds.latest). */
  readonly asOf = input.required<string>();
  readonly earliest = input<string | null>(null);
  /** ISO выбранного слепка (датафрейм) — маркер на графике. */
  readonly selectedDate = input<string | null>(null);

  readonly store = model<StoreFilter>('all');

  /** Правый край видимого окна (непрерывный день). */
  private readonly rangeEndDay = signal(0);
  /** Ширина окна в днях (непрерывная). */
  private readonly spanDays = signal(STOCK_DYNAMICS_DEFAULT_SPAN_DAYS);

  private dragMode: DragMode | null = null;
  private dragPointerId: number | null = null;
  private dragSvg: SVGSVGElement | null = null;
  private dragStartX = 0;
  private dragStartRangeEndDay = 0;
  private dragStartSpan = STOCK_DYNAMICS_DEFAULT_SPAN_DAYS;
  private viewportBooted = false;

  protected readonly storeOptions: Array<{ value: StoreFilter; label: string }> = [
    { value: 'all', label: 'Все склады' },
    { value: 'k', label: CAT_NAME.k },
    { value: 'b', label: CAT_NAME.b },
    { value: 'w', label: CAT_NAME.w },
  ];

  protected readonly cursor = signal<'default' | 'grab' | 'grabbing' | 'ew-resize'>('default');
  protected readonly chartWidth = STOCK_CHART_WIDTH;
  protected readonly chartHeight = STOCK_CHART_HEIGHT;

  protected readonly canReset = computed(() => {
    const asOf = this.asOf();
    if (!asOf || !this.viewportBooted) return false;
    const defaultEnd = clampRangeEndDay(
      isoToDayNumber(asOf),
      STOCK_DYNAMICS_DEFAULT_SPAN_DAYS,
      asOf,
      this.earliest(),
    );
    return (
      this.store() !== 'all' ||
      Math.abs(this.spanDays() - STOCK_DYNAMICS_DEFAULT_SPAN_DAYS) > 0.05 ||
      Math.abs(this.rangeEndDay() - defaultEnd) > 0.05
    );
  });

  constructor() {
    effect(() => {
      const asOf = this.asOf();
      const earliest = this.earliest();
      if (!asOf) return;
      untracked(() => {
        if (!this.viewportBooted) {
          this.viewportBooted = true;
          this.spanDays.set(STOCK_DYNAMICS_DEFAULT_SPAN_DAYS);
          this.rangeEndDay.set(
            clampRangeEndDay(
              isoToDayNumber(asOf),
              STOCK_DYNAMICS_DEFAULT_SPAN_DAYS,
              asOf,
              earliest,
            ),
          );
          return;
        }
        // Смена даты слепка / границ — только мягкий clamp, без сброса zoom/pan.
        this.rangeEndDay.set(
          clampRangeEndDay(this.rangeEndDay(), this.spanDays(), asOf, earliest),
        );
      });
    });
  }

  protected readonly caption =
    'Стоимость остатков по дням. Нажмите точку — откроется слепок за этот день';

  protected readonly ariaLabel =
    'Динамика товарных запасов: стоимость остатков во времени';

  protected readonly chart = computed(() =>
    buildContinuousStockLayout(
      this.points(),
      this.store(),
      this.rangeEndDay() || isoToDayNumber(this.asOf()),
      this.spanDays(),
      this.selectedDate(),
    ),
  );

  resetView(): void {
    const asOf = this.asOf();
    if (!asOf) return;
    this.store.set('all');
    this.spanDays.set(STOCK_DYNAMICS_DEFAULT_SPAN_DAYS);
    this.rangeEndDay.set(
      clampRangeEndDay(
        isoToDayNumber(asOf),
        STOCK_DYNAMICS_DEFAULT_SPAN_DAYS,
        asOf,
        this.earliest(),
      ),
    );
    this.cursor.set('default');
  }

  /** Клик по точке — выбор дня слепка на странице «Склад». */
  onDotPointerDown(event: PointerEvent, date: string): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const latest = this.asOf();
    if (latest && date === latest) {
      this.warehousePeriod.selectLatest();
    } else {
      this.warehousePeriod.setDay(date);
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const svg = event.currentTarget as SVGSVGElement | null;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const { x, y } = clientToSvgPoint(event.clientX, event.clientY, rect);
    const zone = hitChartZone(x, y);
    if (zone === 'none') return;

    event.preventDefault();
    event.stopPropagation();

    this.dragMode = zone === 'axis' ? 'zoom' : 'pan';
    this.dragPointerId = event.pointerId;
    this.dragSvg = svg;
    this.dragStartX = event.clientX;
    this.dragStartRangeEndDay =
      this.rangeEndDay() || isoToDayNumber(this.asOf());
    this.dragStartSpan = this.spanDays();
    this.cursor.set(zone === 'axis' ? 'ew-resize' : 'grabbing');

    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      /* older Safari */
    }
  }

  onPointerMoveHover(event: PointerEvent): void {
    if (this.dragMode !== null) return;
    const svg = event.currentTarget as SVGSVGElement | null;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const { x, y } = clientToSvgPoint(event.clientX, event.clientY, rect);
    const zone = hitChartZone(x, y);
    this.cursor.set(
      zone === 'axis' ? 'ew-resize' : zone === 'plot' ? 'grab' : 'default',
    );
  }

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent): void {
    if (this.dragMode === null || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();
    this.applyDrag(event.clientX);
  }

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.endDrag();
  }

  @HostListener('document:pointercancel', ['$event'])
  onDocumentPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.endDrag();
  }

  onPointerLeave(): void {
    if (this.dragMode !== null) return;
    this.cursor.set('default');
  }

  private applyDrag(clientX: number): void {
    const svg = this.dragSvg;
    if (!svg || this.dragMode === null) return;

    const rect = svg.getBoundingClientRect();
    const plotWidthPx = Math.max(
      1,
      rect.width *
        ((STOCK_CHART_WIDTH - STOCK_CHART_PAD_LEFT - STOCK_CHART_PAD_RIGHT) /
          STOCK_CHART_WIDTH),
    );
    const dx = clientX - this.dragStartX;

    if (this.dragMode === 'pan') {
      // Непрерывный сдвиг: полный sweep ≈ текущему span.
      const daysDelta = (-dx / plotWidthPx) * this.dragStartSpan;
      this.rangeEndDay.set(
        clampRangeEndDay(
          this.dragStartRangeEndDay + daysDelta,
          this.spanDays(),
          this.asOf(),
          this.earliest(),
        ),
      );
      return;
    }

    // Zoom относительно горизонтального центра окна.
    // Вправо — расширение, влево — сужение.
    const factor = Math.exp(dx / 120);
    const nextSpan = clampSpanDays(this.dragStartSpan * factor);
    const center = this.dragStartRangeEndDay - this.dragStartSpan / 2;
    const nextEnd = center + nextSpan / 2;
    this.spanDays.set(nextSpan);
    this.rangeEndDay.set(
      clampRangeEndDay(nextEnd, nextSpan, this.asOf(), this.earliest()),
    );
  }

  private endDrag(): void {
    const svg = this.dragSvg;
    const pointerId = this.dragPointerId;
    if (svg && pointerId !== null) {
      try {
        svg.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    }
    this.dragMode = null;
    this.dragPointerId = null;
    this.dragSvg = null;
    this.cursor.set('default');
  }
}

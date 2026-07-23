import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { DataFreshnessService } from '../../../../core/data/data-freshness.service';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { DatePillComponent } from '../../../../ui/molecules/date-pill/date-pill.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import type { SegmentOption } from '../../../../ui/molecules/segment-control/segment-control.model';
import type { SalesPeriodPreset } from '../../data/sales-period.model';
import {
  formatSalesPeriodLabel,
  salesPresetNote,
} from '../../data/sales-period-range.utils';
import { SalesPeriodService } from '../../data/sales-period.service';
import { SalesDateRangeCalendarComponent } from '../../molecules/sales-date-range-calendar/sales-date-range-calendar.component';

const PRESET_OPTIONS: SegmentOption<SalesPeriodPreset>[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

@Component({
  selector: 'app-sales-period-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SegmentControlComponent,
    DatePillComponent,
    ButtonComponent,
    HeadingComponent,
    TextComponent,
    SalesDateRangeCalendarComponent,
  ],
  templateUrl: './sales-period-bar.component.html',
  styleUrl: './sales-period-bar.component.scss',
})
export class SalesPeriodBarComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly salesPeriod = inject(SalesPeriodService);
  private readonly freshness = inject(DataFreshnessService);
  private readonly calendar = viewChild(SalesDateRangeCalendarComponent);

  protected readonly presetOptions = PRESET_OPTIONS;
  protected readonly panelOpen = signal(false);

  protected readonly draftFrom = signal('');
  protected readonly draftTo = signal('');

  protected readonly preset = this.salesPeriod.preset;

  protected readonly label = computed(() => {
    const range = this.salesPeriod.range();
    if (!range) return '…';
    return formatSalesPeriodLabel(range.dateFrom, range.dateTo);
  });

  protected readonly note = computed(() => salesPresetNote(this.salesPeriod.preset()));

  protected readonly maxDate = computed(
    () => this.freshness.freshness()?.latestSalesDay ?? undefined,
  );

  protected readonly draftLabel = computed(() => {
    const from = this.draftFrom();
    const to = this.draftTo();
    if (!from) return 'Не выбран';
    if (!to) return formatSalesPeriodLabel(from, from) + ' …';
    return formatSalesPeriodLabel(from, to);
  });

  protected readonly hint = computed(() => {
    const max = this.maxDate();
    if (!max) return '';
    return `Данные до ${formatSalesPeriodLabel(max, max)}`;
  });

  protected readonly canApply = computed(() => {
    const from = this.draftFrom().trim();
    const to = this.draftTo().trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
  });

  onPresetChange(value: SalesPeriodPreset): void {
    if (value === 'day' || value === 'week' || value === 'month') {
      this.salesPeriod.setPreset(value);
      this.panelOpen.set(false);
    }
  }

  togglePanel(): void {
    const next = !this.panelOpen();
    if (next) {
      const range = this.salesPeriod.range();
      this.draftFrom.set(range?.dateFrom ?? '');
      this.draftTo.set(range?.dateTo ?? '');
      this.panelOpen.set(true);
      queueMicrotask(() => this.calendar()?.syncViewToSelection());
      return;
    }
    this.panelOpen.set(false);
  }

  applyRange(): void {
    if (!this.canApply()) return;
    this.salesPeriod.setRange(this.draftFrom().trim(), this.draftTo().trim());
    this.panelOpen.set(false);
  }

  resetDraft(): void {
    const range = this.salesPeriod.range();
    this.draftFrom.set(range?.dateFrom ?? '');
    this.draftTo.set(range?.dateTo ?? '');
    queueMicrotask(() => this.calendar()?.syncViewToSelection());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.panelOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.host.nativeElement.contains(target)) return;
    this.panelOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.panelOpen.set(false);
  }
}

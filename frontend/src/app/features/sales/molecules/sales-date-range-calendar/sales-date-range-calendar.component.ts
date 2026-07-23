import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';

import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import {
  buildSalesCalendarCells,
  formatSalesCalendarMonthTitle,
  parseSalesIsoDate,
  shiftCalendarMonth,
  SALES_WEEKDAY_LABELS,
  type SalesCalendarCell,
} from '../../data/sales-calendar.utils';

@Component({
  selector: 'app-sales-date-range-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TextComponent],
  templateUrl: './sales-date-range-calendar.component.html',
  styleUrl: './sales-date-range-calendar.component.scss',
})
export class SalesDateRangeCalendarComponent {
  readonly dateFrom = model<string>('');
  readonly dateTo = model<string>('');
  readonly maxDate = input<string | undefined>(undefined);

  protected readonly weekdayLabels = SALES_WEEKDAY_LABELS;

  private readonly viewYear = signal(2026);
  private readonly viewMonth = signal(6);
  /** После клика «от» ждём клик «до»; иначе следующий клик начинает новый диапазон. */
  private readonly awaitingEnd = signal(false);

  protected readonly monthTitle = computed(() =>
    formatSalesCalendarMonthTitle(this.viewYear(), this.viewMonth()),
  );

  protected readonly cells = computed(() =>
    buildSalesCalendarCells(
      this.viewYear(),
      this.viewMonth(),
      this.dateFrom() || null,
      this.dateTo() || null,
      this.maxDate() ?? null,
    ),
  );

  protected readonly pickHint = computed(() =>
    this.awaitingEnd() ? 'Выберите конечную дату или примените один день' : 'Выберите начальную дату',
  );

  /** Синхронизировать видимый месяц с текущим draft (вызывать при открытии панели). */
  syncViewToSelection(): void {
    const anchor = this.dateTo() || this.dateFrom() || this.maxDate() || '';
    const parsed = parseSalesIsoDate(anchor);
    if (!parsed) return;
    this.viewYear.set(parsed.year);
    this.viewMonth.set(parsed.month);
    this.awaitingEnd.set(false);
  }

  shiftMonth(delta: number): void {
    const next = shiftCalendarMonth(this.viewYear(), this.viewMonth(), delta);
    this.viewYear.set(next.year);
    this.viewMonth.set(next.month);
  }

  selectDay(cell: SalesCalendarCell): void {
    if (!cell.iso || cell.disabled) return;

    if (!this.awaitingEnd()) {
      this.dateFrom.set(cell.iso);
      this.dateTo.set(cell.iso);
      this.awaitingEnd.set(true);
      return;
    }

    const from = this.dateFrom();
    const to = cell.iso;
    if (from && to && from > to) {
      this.dateFrom.set(to);
      this.dateTo.set(from);
    } else {
      this.dateTo.set(to);
    }
    this.awaitingEnd.set(false);
  }

  canPrevMonth(): boolean {
    return true;
  }

  canNextMonth(): boolean {
    const max = this.maxDate();
    if (!max) return true;
    const parsed = parseSalesIsoDate(max);
    if (!parsed) return true;
    const next = shiftCalendarMonth(this.viewYear(), this.viewMonth(), 1);
    return (
      next.year < parsed.year ||
      (next.year === parsed.year && next.month <= parsed.month)
    );
  }
}

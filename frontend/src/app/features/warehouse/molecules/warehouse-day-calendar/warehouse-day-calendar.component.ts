import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import {
  buildWarehouseCalendarCells,
  formatWarehouseMonthTitle,
  parseWarehouseIso,
  shiftWarehouseMonth,
  WAREHOUSE_WEEKDAY_LABELS,
  type WarehouseCalendarCell,
} from '../../data/warehouse-period.utils';

@Component({
  selector: 'app-warehouse-day-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TextComponent],
  templateUrl: './warehouse-day-calendar.component.html',
  styleUrl: './warehouse-day-calendar.component.scss',
})
export class WarehouseDayCalendarComponent {
  /** Выбранный день; `null` — режим «текущий день» (подсветки нет, или latest). */
  readonly selectedIso = input<string | null>(null);
  /** День для подсветки в режиме latest (обычно dataBounds.latest). */
  readonly highlightIso = input<string | null>(null);
  readonly availableDates = input<readonly string[]>([]);
  readonly earliest = input<string | null>(null);
  readonly latest = input<string | null>(null);

  readonly daySelected = output<string>();

  protected readonly weekdayLabels = WAREHOUSE_WEEKDAY_LABELS;

  private readonly viewYear = signal(2026);
  private readonly viewMonth = signal(7);

  private readonly availableSet = computed(() => new Set(this.availableDates()));

  protected readonly monthTitle = computed(() =>
    formatWarehouseMonthTitle(this.viewYear(), this.viewMonth()),
  );

  protected readonly cells = computed(() => {
    const selected = this.selectedIso() ?? this.highlightIso();
    return buildWarehouseCalendarCells(
      this.viewYear(),
      this.viewMonth(),
      selected,
      this.availableSet(),
    );
  });

  /** Синхронизировать видимый месяц с selection / latest. */
  syncViewToSelection(): void {
    const anchor = this.selectedIso() ?? this.highlightIso() ?? this.latest() ?? '';
    const parsed = parseWarehouseIso(anchor);
    if (!parsed) return;
    this.viewYear.set(parsed.year);
    this.viewMonth.set(parsed.month);
  }

  shiftMonth(delta: number): void {
    const next = shiftWarehouseMonth(this.viewYear(), this.viewMonth(), delta);
    this.viewYear.set(next.year);
    this.viewMonth.set(next.month);
  }

  selectDay(cell: WarehouseCalendarCell): void {
    if (!cell.iso || cell.disabled) return;
    this.daySelected.emit(cell.iso);
  }

  canPrevMonth(): boolean {
    const earliest = this.earliest();
    if (!earliest) return true;
    const parsed = parseWarehouseIso(earliest);
    if (!parsed) return true;
    const prev = shiftWarehouseMonth(this.viewYear(), this.viewMonth(), -1);
    return (
      prev.year > parsed.year ||
      (prev.year === parsed.year && prev.month >= parsed.month)
    );
  }

  canNextMonth(): boolean {
    const latest = this.latest();
    if (!latest) return true;
    const parsed = parseWarehouseIso(latest);
    if (!parsed) return true;
    const next = shiftWarehouseMonth(this.viewYear(), this.viewMonth(), 1);
    return (
      next.year < parsed.year ||
      (next.year === parsed.year && next.month <= parsed.month)
    );
  }
}

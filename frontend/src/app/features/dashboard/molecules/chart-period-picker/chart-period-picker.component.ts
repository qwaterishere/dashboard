import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type { PeriodGranularity } from '../../../../shared/models/common.model';
import type { ChartPeriodSelection } from '../../../../shared/models/chart-period.model';
import type { DataBoundsV2 } from '../../../../shared/models/dashboard-v2.model';
import {
  CHART_MONTH_LABELS,
  isMonthInBounds,
  isYearInBounds,
  listAvailableYears,
  listWeekRangesInMonth,
  resolveChartPeriodBounds,
  resolveDefaultWeekForMonth,
  resolveDefaultWeekRange,
  type WeekRangeOption,
} from '../../../../shared/utils/chart-period.utils';
import { formatBoundRange } from '../../../../shared/utils/chart-period-picker.utils';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { DatePillComponent } from '../../../../ui/molecules/date-pill/date-pill.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';

@Component({
  selector: 'app-chart-period-picker',
  standalone: true,
  imports: [ButtonComponent, DatePillComponent, HeadingComponent, TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker" [class.picker--week]="granularity() === 'week'" (click)="$event.stopPropagation()">
      <app-date-pill
        [label]="label()"
        [note]="note()"
        [interactive]="true"
        [ariaExpanded]="open()"
        ariaHasPopup="dialog"
        (pressed)="toggle()"
      />

      @if (open()) {
        <div class="picker__panel" role="dialog" aria-label="Выбор периода">
          <app-heading [level]="4" [text]="panelTitle()" />

          @if (granularity() === 'year') {
            <div class="picker__years" role="listbox" aria-label="Год">
              @for (year of yearOptions(); track year) {
                <app-button
                  variant="default"
                  type="button"
                  class="picker__year"
                  [class.picker__year--active]="draftYear() === year"
                  [disabled]="!isYearAvailable(year)"
                  (pressed)="selectYear(year)"
                >
                  {{ year }}
                </app-button>
              }
            </div>
          } @else {
            <div class="picker__year-nav">
              <app-button
                variant="default"
                type="button"
                class="picker__nav-btn"
                [disabled]="!canPrevYear()"
                (pressed)="shiftYear(-1)"
                aria-label="Предыдущий год"
              >
                ‹
              </app-button>
              <span class="picker__year-label">{{ draftYear() }}</span>
              <app-button
                variant="default"
                type="button"
                class="picker__nav-btn"
                [disabled]="!canNextYear()"
                (pressed)="shiftYear(1)"
                aria-label="Следующий год"
              >
                ›
              </app-button>
            </div>

            <div class="picker__months" role="listbox" aria-label="Месяц">
              @for (month of monthOptions; track month) {
                <app-button
                  variant="default"
                  type="button"
                  class="picker__month"
                  [class.picker__month--active]="draftMonth() === month"
                  [disabled]="!isMonthAvailable(month)"
                  (pressed)="selectMonth(month)"
                >
                  {{ monthLabel(month) }}
                </app-button>
              }
            </div>

            @if (granularity() === 'week') {
              <div class="picker__week-section">
                <app-heading [level]="4" text="Неделя" />
                <div class="picker__weeks" role="listbox" aria-label="Неделя">
                  @for (week of weekOptions(); track week.startDate) {
                    <app-button
                      variant="default"
                      type="button"
                      class="picker__week"
                      [class.picker__week--active]="isWeekActive(week)"
                      (pressed)="selectWeek(week)"
                    >
                      <span class="picker__week-label">{{ week.label }}</span>
                      <span class="picker__week-suffix">пн–вс · {{ monthLabel(draftMonth()) }}</span>
                    </app-button>
                  }
                </div>
              </div>
            }
          }

          <div class="picker__actions">
            <app-button
              variant="primary"
              type="button"
              class="picker__apply"
              [disabled]="!canApply()"
              (pressed)="apply()"
            >
              Применить
            </app-button>
            @if (showReset()) {
              <app-button variant="pill" type="button" (pressed)="reset()">
                Сбросить
              </app-button>
            }
          </div>

          @if (hint()) {
            <app-text tone="caption">{{ hint() }}</app-text>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './chart-period-picker.component.scss',
})
export class ChartPeriodPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly label = input.required<string>();
  readonly note = input('');
  readonly granularity = input<PeriodGranularity>('month');
  readonly bounds = input<DataBoundsV2 | null>(null);
  readonly activePeriod = input.required<{ year: number; month: number; dayFrom: number; dayTo: number }>();
  readonly selection = input<ChartPeriodSelection | null>(null);
  readonly showReset = input(false);

  readonly applied = output<ChartPeriodSelection>();
  readonly resetSelection = output<void>();

  protected readonly open = signal(false);
  protected readonly draftYear = signal(2026);
  protected readonly draftMonth = signal(6);
  protected readonly draftWeekStartDate = signal<string | null>(null);
  protected readonly draftWeekEndDate = signal<string | null>(null);

  protected readonly monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);

  protected readonly periodLimits = computed(() => resolveChartPeriodBounds(this.bounds()));

  protected readonly yearOptions = computed(() =>
    listAvailableYears(this.periodLimits(), this.activePeriod().year),
  );

  protected readonly hint = computed(() => formatBoundRange(this.bounds()));

  protected readonly weekOptions = computed(() =>
    listWeekRangesInMonth(
      this.draftYear(),
      this.draftMonth(),
      this.bounds(),
      this.ensureWeekRange(),
    ),
  );

  protected panelTitle(): string {
    if (this.granularity() === 'year') return 'Выбор года';
    if (this.granularity() === 'week') return 'Месяц и неделя';
    return 'Выбор месяца';
  }

  protected canPrevYear(): boolean {
    const limits = this.periodLimits();
    if (!limits) return true;
    return this.draftYear() > limits.minYear;
  }

  protected canNextYear(): boolean {
    const limits = this.periodLimits();
    if (!limits) return true;
    return this.draftYear() < limits.maxYear;
  }

  protected isYearAvailable(year: number): boolean {
    return isYearInBounds(year, this.periodLimits());
  }

  protected isMonthAvailable(month: number): boolean {
    return isMonthInBounds(this.draftYear(), month, this.periodLimits());
  }

  protected isWeekActive(week: WeekRangeOption): boolean {
    return (
      this.draftWeekStartDate() === week.startDate &&
      this.draftWeekEndDate() === week.endDate
    );
  }

  protected canApply(): boolean {
    if (this.granularity() === 'year') {
      return this.isYearAvailable(this.draftYear());
    }
    if (!this.isMonthAvailable(this.draftMonth())) return false;
    if (this.granularity() === 'week') {
      return this.draftWeekStartDate() != null && this.draftWeekEndDate() != null;
    }
    return true;
  }

  protected monthLabel(month: number): string {
    return CHART_MONTH_LABELS[month - 1] ?? String(month);
  }

  toggle(): void {
    const next = !this.open();
    if (next) {
      this.syncDraftFromActive();
    }
    this.open.set(next);
  }

  selectYear(year: number): void {
    if (!this.isYearAvailable(year)) return;
    this.draftYear.set(year);
  }

  selectMonth(month: number): void {
    if (!this.isMonthAvailable(month)) return;
    this.draftMonth.set(month);
    if (this.granularity() === 'week') {
      this.pickDefaultWeekForDraftMonth();
    }
  }

  selectWeek(week: WeekRangeOption): void {
    this.draftWeekStartDate.set(week.startDate);
    this.draftWeekEndDate.set(week.endDate);
  }

  shiftYear(delta: number): void {
    const next = this.draftYear() + delta;
    if (!this.isYearAvailable(next)) return;
    this.draftYear.set(next);
    if (!this.isMonthAvailable(this.draftMonth())) {
      const fallback = this.monthOptions.find((month) => this.isMonthInBoundsForYear(next, month));
      if (fallback) {
        this.draftMonth.set(fallback);
      }
    }
    if (this.granularity() === 'week') {
      this.pickDefaultWeekForDraftMonth();
    }
  }

  apply(): void {
    if (!this.canApply()) return;

    if (this.granularity() === 'year') {
      this.applied.emit({ year: this.draftYear(), month: 1 });
    } else if (this.granularity() === 'week') {
      this.applied.emit({
        year: this.draftYear(),
        month: this.draftMonth(),
        weekStartDate: this.draftWeekStartDate()!,
        weekEndDate: this.draftWeekEndDate()!,
      });
    } else {
      this.applied.emit({ year: this.draftYear(), month: this.draftMonth() });
    }
    this.open.set(false);
  }

  reset(): void {
    this.resetSelection.emit();
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.host.nativeElement.contains(target)) return;
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }

  private syncDraftFromActive(): void {
    const active = this.activePeriod();
    const selected = this.selection();
    this.draftYear.set(selected?.year ?? active.year);
    this.draftMonth.set(selected?.month ?? active.month);

    if (this.granularity() !== 'week') return;

    if (
      selected?.weekStartDate &&
      selected.weekEndDate &&
      selected.year === this.draftYear() &&
      selected.month === this.draftMonth()
    ) {
      this.draftWeekStartDate.set(selected.weekStartDate);
      this.draftWeekEndDate.set(selected.weekEndDate);
      return;
    }

    const fallback = resolveDefaultWeekRange(
      active.year,
      active.month,
      active.dayFrom,
      active.dayTo,
    );
    this.draftWeekStartDate.set(fallback.startDate);
    this.draftWeekEndDate.set(fallback.endDate);
  }

  private ensureWeekRange(): { startDate: string; endDate: string } | undefined {
    const start = this.draftWeekStartDate();
    const end = this.draftWeekEndDate();
    if (!start || !end) return undefined;
    return { startDate: start, endDate: end };
  }

  private pickDefaultWeekForDraftMonth(): void {
    const active = this.activePeriod();
    const week = resolveDefaultWeekForMonth(
      this.draftYear(),
      this.draftMonth(),
      this.bounds(),
      active,
    );
    this.draftWeekStartDate.set(week.startDate);
    this.draftWeekEndDate.set(week.endDate);
  }

  private isMonthInBoundsForYear(year: number, month: number): boolean {
    return isMonthInBounds(year, month, this.periodLimits());
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';

import type { PeriodGranularity } from '../../../../shared/models/common.model';
import type { ChartPeriodSelection, ChartWeekRange } from '../../../../shared/models/chart-period.model';
import type { DataBounds } from '../../../../shared/models/dashboard-api.model';
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
import {
  isCompareDraftSameAsDataframe,
  isDataframeMonth,
  isDataframeWeek,
} from '../../../../shared/utils/compare-period.utils';
import { formatBoundRange } from '../../../../shared/utils/chart-period-picker.utils';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { DatePillComponent } from '../../../../ui/molecules/date-pill/date-pill.component';
import { ComparePillComponent } from '../../../../ui/molecules/compare-pill/compare-pill.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';

@Component({
  selector: 'app-chart-period-picker',
  standalone: true,
  imports: [ButtonComponent, DatePillComponent, ComparePillComponent, HeadingComponent, TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="picker"
      [class.picker--week]="granularity() === 'week'"
      [class.picker--compare]="triggerKind() === 'compare'"
      (click)="$event.stopPropagation()"
    >
      @if (triggerKind() === 'compare') {
        <app-compare-pill
          [compareWith]="compareWith()"
          [interactive]="true"
          [ariaExpanded]="panelOpen()"
          ariaHasPopup="dialog"
          (pressed)="toggle()"
        />
      } @else {
        <app-date-pill
          [label]="label()"
          [note]="note()"
          [interactive]="true"
          [ariaExpanded]="panelOpen()"
          ariaHasPopup="dialog"
          (pressed)="toggle()"
        />
      }

      @if (panelOpen()) {
        <div
          class="picker__panel"
          role="dialog"
          [attr.aria-label]="panelAriaLabel()"
        >
          <app-heading [level]="4" [text]="panelTitle()" />

          @if (triggerKind() === 'compare' && dataframePeriodLabel()) {
            <p class="picker__dataframe-note">
              Текущий период датафрейма:
              <strong>{{ dataframePeriodLabel() }}</strong>
            </p>
          }

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
                  [class.picker__month--dataframe]="isDataframeMonthOption(month)"
                  [disabled]="!isMonthSelectable(month)"
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
                      [class.picker__week--dataframe]="isDataframeWeekOption(week)"
                      [disabled]="!isWeekSelectable(week)"
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
  readonly label = input('');
  readonly note = input('');
  readonly granularity = input<PeriodGranularity>('month');
  readonly triggerKind = input<'period' | 'compare'>('period');
  readonly compareWith = input('');
  readonly bounds = input<DataBounds | null>(null);
  readonly activePeriod = input.required<{ year: number; month: number; dayFrom: number; dayTo: number }>();
  readonly selection = input<ChartPeriodSelection | null>(null);
  readonly showReset = input(false);
  readonly dataframePeriod = input<{ year: number; month: number; dayFrom: number; dayTo: number } | null>(null);
  readonly dataframeWeekRange = input<ChartWeekRange | null>(null);
  readonly dataframePeriodLabel = input('');
  readonly panelOpen = input(false);
  readonly panelOpenChange = output<boolean>();

  readonly applied = output<ChartPeriodSelection>();
  readonly resetSelection = output<void>();
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
    if (this.triggerKind() === 'compare') return 'Период сравнения LfL';
    if (this.granularity() === 'year') return 'Выбор года';
    if (this.granularity() === 'week') return 'Месяц и неделя';
    return 'Выбор месяца';
  }

  protected panelAriaLabel(): string {
    return this.triggerKind() === 'compare' ? 'Выбор периода сравнения LfL' : 'Выбор периода';
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

  protected isMonthSelectable(month: number): boolean {
    return this.isMonthAvailable(month) && !this.isDataframeMonthOption(month);
  }

  protected isDataframeMonthOption(month: number): boolean {
    if (this.triggerKind() !== 'compare') return false;
    const dataframe = this.dataframePeriod();
    if (!dataframe) return false;
    return isDataframeMonth(this.draftYear(), month, dataframe);
  }

  protected isDataframeWeekOption(week: WeekRangeOption): boolean {
    if (this.triggerKind() !== 'compare') return false;
    const dataframeWeek = this.dataframeWeekRange();
    if (!dataframeWeek) return false;
    return isDataframeWeek(
      { startDate: week.startDate, endDate: week.endDate },
      dataframeWeek,
    );
  }

  protected isWeekSelectable(week: WeekRangeOption): boolean {
    return !this.isDataframeWeekOption(week);
  }

  protected isWeekActive(week: WeekRangeOption): boolean {
    return (
      this.draftWeekStartDate() === week.startDate &&
      this.draftWeekEndDate() === week.endDate
    );
  }

  protected canApply(): boolean {
    if (this.isDraftSameAsDataframe()) return false;
    if (this.granularity() === 'year') {
      return this.isYearAvailable(this.draftYear());
    }
    if (!this.isMonthAvailable(this.draftMonth())) return false;
    if (this.granularity() === 'week') {
      return (
        this.draftWeekStartDate() != null &&
        this.draftWeekEndDate() != null &&
        !this.isDraftSameAsDataframe()
      );
    }
    return true;
  }

  protected monthLabel(month: number): string {
    return CHART_MONTH_LABELS[month - 1] ?? String(month);
  }

  toggle(): void {
    const next = !this.panelOpen();
    if (next) {
      this.syncDraftFromActive();
    }
    this.panelOpenChange.emit(next);
  }

  selectYear(year: number): void {
    if (!this.isYearAvailable(year)) return;
    this.draftYear.set(year);
  }

  selectMonth(month: number): void {
    if (!this.isMonthSelectable(month)) return;
    this.draftMonth.set(month);
    if (this.granularity() === 'week') {
      this.pickDefaultWeekForDraftMonth();
    }
  }

  selectWeek(week: WeekRangeOption): void {
    if (!this.isWeekSelectable(week)) return;
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
    this.panelOpenChange.emit(false);
  }

  reset(): void {
    this.resetSelection.emit();
    this.panelOpenChange.emit(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panelOpen()) {
      this.panelOpenChange.emit(false);
    }
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

    if (this.isDraftSameAsDataframe()) {
      this.pickDefaultWeekForDraftMonth();
    }
  }

  private ensureWeekRange(): { startDate: string; endDate: string } | undefined {
    const start = this.draftWeekStartDate();
    const end = this.draftWeekEndDate();
    if (!start || !end) return undefined;
    return { startDate: start, endDate: end };
  }

  private pickDefaultWeekForDraftMonth(): void {
    if (this.granularity() === 'week' && this.triggerKind() === 'compare') {
      const alternative = this.weekOptions().find((week) => this.isWeekSelectable(week));
      if (alternative) {
        this.draftWeekStartDate.set(alternative.startDate);
        this.draftWeekEndDate.set(alternative.endDate);
        return;
      }
    }

    const active = this.activePeriod();
    const week = resolveDefaultWeekForMonth(
      this.draftYear(),
      this.draftMonth(),
      this.bounds(),
      active,
    );
    if (
      this.triggerKind() === 'compare' &&
      this.dataframeWeekRange() &&
      isDataframeWeek(week, this.dataframeWeekRange()!)
    ) {
      const alternative = this.weekOptions().find((option) => this.isWeekSelectable(option));
      if (alternative) {
        this.draftWeekStartDate.set(alternative.startDate);
        this.draftWeekEndDate.set(alternative.endDate);
        return;
      }
    }

    this.draftWeekStartDate.set(week.startDate);
    this.draftWeekEndDate.set(week.endDate);
  }

  private isDraftSameAsDataframe(): boolean {
    if (this.triggerKind() !== 'compare') return false;
    const dataframe = this.dataframePeriod();
    if (!dataframe) return false;
    return isCompareDraftSameAsDataframe(
      this.draftYear(),
      this.draftMonth(),
      this.draftWeekStartDate(),
      this.draftWeekEndDate(),
      this.granularity(),
      { period: dataframe, weekRange: this.dataframeWeekRange() ?? undefined },
    );
  }

  private isMonthInBoundsForYear(year: number, month: number): boolean {
    return isMonthInBounds(year, month, this.periodLimits());
  }
}

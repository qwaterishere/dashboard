import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { KFormatPipe } from '../../../../shared/pipes/format.pipes';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import {
  buildMonthDayPlans,
  monthGridOffset,
  sumMonthDayPlans,
  weekProfileIndex,
  type MonthDayPlan,
} from '../../data/targets-revenue-plan.utils';

const WEEKDAY_HEADERS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

@Component({
  selector: 'app-month-plan-calendar',
  standalone: true,
  imports: [KFormatPipe, TextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="month-plan-calendar">
      <div class="month-plan-calendar__head">
        <span class="month-plan-calendar__title">План по дням</span>
        <app-text tone="muted">
          Σ дней = {{ plansSum() | kFormat }} · план месяца = {{ monthPlan() | kFormat }}
        </app-text>
      </div>

      <div class="month-plan-calendar__weekdays" aria-hidden="true">
        @for (label of weekdayHeaders; track label) {
          <span class="month-plan-calendar__weekday">{{ label }}</span>
        }
      </div>

      <div
        class="month-plan-calendar__grid"
        role="grid"
        [attr.aria-label]="'План выручки на ' + periodLabel()"
      >
        @for (slot of leadingSlots(); track $index) {
          <div class="month-plan-calendar__pad" role="presentation"></div>
        }
        @for (plan of dayPlans(); track plan.day) {
          <button
            type="button"
            class="month-plan-calendar__day"
            [class.month-plan-calendar__day--override]="plan.isOverride"
            [class.month-plan-calendar__day--weekend]="isWeekend(plan.day)"
            role="gridcell"
            [attr.aria-label]="dayAriaLabel(plan)"
            (click)="startEdit(plan)"
          >
            <span class="month-plan-calendar__day-num">{{ plan.day }}</span>
            @if (editingDay() === plan.day) {
              <input
                class="month-plan-calendar__input"
                type="number"
                inputmode="numeric"
                [id]="inputId(plan.day)"
                [value]="editValue()"
                (input)="onEditInput($event)"
                (blur)="commitEdit(plan.day)"
                (keydown.enter)="commitEdit(plan.day)"
                (keydown.escape)="cancelEdit()"
                (click)="$event.stopPropagation()"
              />
            } @else {
              <span class="month-plan-calendar__amount">{{ plan.amount | kFormat }}</span>
            }
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './month-plan-calendar.component.scss',
})
export class MonthPlanCalendarComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly periodLabel = input.required<string>();
  readonly monthPlan = input.required<number>();
  readonly weekProfile = input.required<number[]>();
  readonly overrides = input<Record<number, number>>({});

  readonly overrideChange = output<{ day: number; amount: number | null }>();

  protected readonly weekdayHeaders = WEEKDAY_HEADERS;
  protected readonly editingDay = signal<number | null>(null);
  protected readonly editValue = signal('');

  protected readonly dayPlans = computed(() =>
    buildMonthDayPlans(
      this.year(),
      this.month(),
      this.monthPlan(),
      this.weekProfile(),
      this.overrides(),
    ),
  );

  protected readonly plansSum = computed(() => sumMonthDayPlans(this.dayPlans()));

  protected readonly leadingSlots = computed(() =>
    Array.from({ length: monthGridOffset(this.year(), this.month()) }),
  );

  isWeekend(day: number): boolean {
    const index = weekProfileIndex(this.year(), this.month(), day);
    return index >= 5;
  }

  dayAriaLabel(plan: MonthDayPlan): string {
    const suffix = plan.isOverride ? ', скорректировано вручную' : '';
    return `${plan.day} число, план ${plan.amount}${suffix}`;
  }

  startEdit(plan: MonthDayPlan): void {
    this.editingDay.set(plan.day);
    this.editValue.set(String(plan.amount));
    queueMicrotask(() => document.getElementById(this.inputId(plan.day))?.focus());
  }

  inputId(day: number): string {
    return `month-plan-input-${day}`;
  }

  onEditInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.editValue.set(target.value);
  }

  commitEdit(day: number): void {
    if (this.editingDay() !== day) return;
    const parsed = Number.parseFloat(this.editValue().replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      this.overrideChange.emit({ day, amount: Math.round(parsed) });
    }
    this.editingDay.set(null);
    this.editValue.set('');
  }

  cancelEdit(): void {
    this.editingDay.set(null);
    this.editValue.set('');
  }
}

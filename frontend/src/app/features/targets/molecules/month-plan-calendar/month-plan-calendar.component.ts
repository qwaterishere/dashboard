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
          <div
            class="month-plan-calendar__day"
            [class.month-plan-calendar__day--override]="plan.isOverride"
            [class.month-plan-calendar__day--weekend]="isWeekend(plan.day)"
            [class.month-plan-calendar__day--editing]="editingDay() === plan.day"
            [class.month-plan-calendar__day--disabled]="disabled()"
            role="gridcell"
            [attr.aria-label]="dayAriaLabel(plan)"
            [attr.tabindex]="disabled() || editingDay() === plan.day ? -1 : 0"
            (click)="onDayClick(plan)"
            (keydown.enter)="onDayKeyActivate($event, plan)"
            (keydown.space)="onDayKeyActivate($event, plan)"
          >
            <span class="month-plan-calendar__day-num">{{ plan.day }}</span>
            @if (editingDay() === plan.day) {
              <input
                class="month-plan-calendar__input"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                [id]="inputId(plan.day)"
                [attr.aria-label]="'План на ' + plan.day + ' число'"
                [placeholder]="editPlaceholder()"
                [value]="editValue()"
                (input)="onEditInput($event)"
                (blur)="commitEdit(plan.day)"
                (keydown.enter)="onEnterKey($event, plan.day)"
                (keydown.escape)="onEscapeKey($event)"
                (click)="$event.stopPropagation()"
              />
            } @else {
              <span class="month-plan-calendar__amount">{{ plan.amount | kFormat }}</span>
            }
          </div>
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
  readonly disabled = input(false);

  readonly overrideChange = output<{ day: number; amount: number | null }>();

  protected readonly weekdayHeaders = WEEKDAY_HEADERS;
  protected readonly editingDay = signal<number | null>(null);
  protected readonly editValue = signal('');
  protected readonly editPlaceholder = signal('');

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

  onDayClick(plan: MonthDayPlan): void {
    if (this.editingDay() === plan.day) return;
    this.startEdit(plan);
  }

  onDayKeyActivate(event: Event, plan: MonthDayPlan): void {
    if (this.editingDay() === plan.day) return;
    event.preventDefault();
    this.startEdit(plan);
  }

  startEdit(plan: MonthDayPlan): void {
    if (this.disabled()) return;
    this.editingDay.set(plan.day);
    this.editPlaceholder.set(String(plan.amount));
    // Пустое поле: новый ввод сразу заменяет план, без ручного стирания.
    this.editValue.set('');
    queueMicrotask(() => {
      const el = document.getElementById(this.inputId(plan.day));
      if (el instanceof HTMLInputElement) {
        el.focus();
      }
    });
  }

  inputId(day: number): string {
    return `month-plan-input-${day}`;
  }

  onEditInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.editValue.set(target.value);
  }

  onEnterKey(event: Event, day: number): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      target.blur();
      return;
    }
    this.commitEdit(day);
  }

  onEscapeKey(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cancelEdit();
  }

  commitEdit(day: number): void {
    if (this.editingDay() !== day) return;
    const raw = this.editValue().trim().replace(/\s/g, '').replace(',', '.');
    if (raw === '') {
      this.cancelEdit();
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      this.overrideChange.emit({ day, amount: Math.round(parsed) });
    }
    this.editingDay.set(null);
    this.editValue.set('');
    this.editPlaceholder.set('');
  }

  cancelEdit(): void {
    this.editingDay.set(null);
    this.editValue.set('');
    this.editPlaceholder.set('');
  }
}

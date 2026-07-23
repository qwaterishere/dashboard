import { RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';

import { CurrencyService } from '../../../../core/state/currency.service';
import type {
  TargetsData,
  TargetsFormState,
  TargetsWriteoffMode,
  TargetsWriteoffUnit,
} from '../../../../shared/models/targets.model';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { FormBannerComponent } from '../../../../ui/molecules/form-banner/form-banner.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import {
  cloneTargetsFormState,
  complimentsAmountFromPlan,
  isTargetsFormDirty,
  isTargetsMonthConfigured,
  isTargetsSectionDirty,
  restoreTargetsSection,
  validateTargetsFormState,
  type TargetsFormSection,
} from '../../data/targets-form.utils';
import { MonthPlanCalendarComponent } from '../../molecules/month-plan-calendar/month-plan-calendar.component';
import { TargetNumericFieldComponent } from '../../molecules/target-numeric-field/target-numeric-field.component';
import { TargetSectionComponent } from '../../molecules/target-section/target-section.component';
import { WeekProfileGridComponent } from '../../molecules/week-profile-grid/week-profile-grid.component';
import { TargetFactHintComponent } from '../../molecules/target-fact-hint/target-fact-hint.component';

@Component({
  selector: 'app-targets-form-organism',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ButtonComponent,
    FormBannerComponent,
    SegmentControlComponent,
    TargetFactHintComponent,
    TargetNumericFieldComponent,
    TargetSectionComponent,
    MonthPlanCalendarComponent,
    WeekProfileGridComponent,
  ],
  template: `
    <div class="targets-form" [class.targets-form--locked]="isLocked()">
      <div class="targets-form__toolbar">
        <div class="targets-form__status">
          @if (isLocked()) {
            <div class="targets-form__locked-note">
              Цели месяца заблокированы. Разблокировка — в
              <a routerLink="/settings">Настройках</a>.
            </div>
          }
          @if (saveSuccess()) {
            <app-form-banner variant="success" [message]="successMessage()" />
          }
          @if (saveError(); as err) {
            <app-form-banner variant="error" [message]="err" />
          }
        </div>
        <div class="targets-form__actions">
          @if (canLockMonth()) {
            <button
              type="button"
              class="targets-form__lock"
              [disabled]="saving() || clearing() || locking() || isLocked()"
              [attr.aria-label]="isLocked() ? 'Цели заблокированы' : 'Заблокировать цели'"
              [title]="isLocked() ? 'Заблокировано' : 'Заблокировать редактирование'"
              (click)="onLockMonth()"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                @if (isLocked()) {
                  <!-- Lucide: lock — https://lucide.dev/icons/lock -->
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                } @else {
                  <!-- Lucide: lock-open — https://lucide.dev/icons/lock-open -->
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                }
              </svg>
            </button>
          }
          @if (!isLocked() && canClearMonth()) {
            <app-button
              variant="danger"
              [disabled]="saving() || clearing() || locking()"
              (pressed)="onClearMonth()"
            >
              {{ clearing() ? 'Очистка…' : 'Очистить цели' }}
            </app-button>
          }
          @if (!isLocked() && canResetAll()) {
            <app-button
              variant="pill"
              [disabled]="saving() || clearing() || locking()"
              (pressed)="onResetAll()"
            >
              Отменить правки
            </app-button>
          }
          @if (!isLocked()) {
            <app-button
              variant="primary"
              [disabled]="saving() || clearing() || locking() || !canSave()"
              (pressed)="onSave()"
            >
              {{ saving() ? 'Сохранение…' : 'Сохранить' }}
            </app-button>
          }
        </div>
      </div>

      <app-target-section
        badge="01"
        title="Выручка — план по дням"
        description="сумма месяца распределяется профилем дней недели; дневные планы уезжают в plan графика на дашборде"
        [canReset]="!isLocked() && canResetSection('revenue')"
        (resetRequested)="onResetSection('revenue')"
      >
        <app-target-numeric-field
          label="План на месяц, {{ currencySymbol() }}"
          inputId="targets-revenue-plan"
          name="targets-revenue-plan"
          [suffix]="currencySymbol()"
          [disabled]="isLocked()"
          [hintPrefix]="'факт ' + data().reference.label + ':'"
          [hintFactMoney]="data().reference.revenueFact"
          [hintPaceMoney]="revenuePaceHint()"
          [value]="form().revenueMonthPlan"
          (valueChange)="updateRevenueMonthPlan($event)"
        />
        <app-week-profile-grid
          [disabled]="isLocked()"
          [profile]="form().weekProfile"
          (profileChange)="updateWeekProfile($event)"
        />
        <app-month-plan-calendar
          [disabled]="isLocked()"
          [year]="data().period.year"
          [month]="data().period.month"
          [periodLabel]="data().period.label"
          [monthPlan]="form().revenueMonthPlan"
          [weekProfile]="form().weekProfile"
          [overrides]="form().dailyPlanOverrides"
          (overrideChange)="updateDailyPlanOverride($event)"
        />
      </app-target-section>

      <app-target-section
        badge="02"
        title="Фудкост по юнитам"
        description="цель на странице «Фудкост» (totals и юниты)"
        [canReset]="!isLocked() && canResetSection('foodcost')"
        (resetRequested)="onResetSection('foodcost')"
      >
        <div class="targets-form__grid targets-form__grid--2">
          @for (unit of data().foodcost; track unit.key) {
            <app-target-numeric-field
              [label]="unit.name + ', %'"
              [inputId]="'targets-fc-' + unit.key"
              [name]="'targets-fc-' + unit.key"
              suffix="%"
              [disabled]="isLocked()"
              [hintPrefix]="'факт ' + data().reference.label + ':'"
              [hintFactPct]="unit.factPct"
              [value]="form().foodcostGoals[unit.key]"
              (valueChange)="updateFoodcostGoal(unit.key, $event)"
            />
          }
        </div>
      </app-target-section>

      <app-target-section
        badge="03"
        title="Списания"
        description="акты списания (порча, бой, срок) — фаза 2 фудкоста"
        [canReset]="!isLocked() && canResetSection('writeoffs')"
        (resetRequested)="onResetSection('writeoffs')"
      >
        <div class="targets-form__grid targets-form__grid--2">
          @for (unit of form().writeoffs; track unit.key) {
            <div class="targets-form__writeoff">
              <div class="targets-form__writeoff-head">
                <span class="targets-form__writeoff-name">{{ unit.name }}</span>
                <app-segment-control
                  size="sm"
                  [disabled]="isLocked()"
                  [options]="writeoffModeOptions()"
                  [value]="unit.mode"
                  (valueChange)="setWriteoffMode(unit.key, $event)"
                />
              </div>
              @if (unit.mode === 'pct') {
                <app-target-numeric-field
                  label="План, % от выручки"
                  [inputId]="'targets-writeoff-pct-' + unit.key"
                  [name]="'targets-writeoff-pct-' + unit.key"
                  suffix="%"
                  [disabled]="isLocked()"
                  [value]="unit.pct"
                  (valueChange)="updateWriteoffPct(unit.key, $event)"
                />
              } @else {
                <app-target-numeric-field
                  label="План, {{ currencySymbol() }}"
                  [inputId]="'targets-writeoff-rub-' + unit.key"
                  [name]="'targets-writeoff-rub-' + unit.key"
                  [suffix]="currencySymbol()"
                  [disabled]="isLocked()"
                  [value]="unit.rub"
                  (valueChange)="updateWriteoffRub(unit.key, $event)"
                />
              }
            </div>
          }
        </div>
      </app-target-section>

      <app-target-section
        badge="04"
        title="Комплименты и представительские"
        description="блок losses страницы «Фудкост», по себестоимости"
        [canReset]="!isLocked() && canResetSection('compliments')"
        (resetRequested)="onResetSection('compliments')"
      >
        <app-target-numeric-field
          label="План, % от выручки"
          inputId="targets-compliments"
          name="targets-compliments"
          suffix="%"
          [disabled]="isLocked()"
          [hintPrefix]="'факт ' + data().reference.label + ':'"
          [hintFactPct]="data().compliments.factPct"
          [hintAmountMoney]="data().compliments.factRub"
          [value]="form().complimentsGoalPct"
          (valueChange)="updateComplimentsGoalPct($event)"
        />
        <app-target-fact-hint
          [prefix]="'от плана выручки: '"
          [amountMoney]="complimentsPlanAmount()"
        />
      </app-target-section>

      <app-target-section
        badge="05"
        title="Инвентаризация"
        description="допустимая недостача по итогам месячной инвентаризации"
        [canReset]="!isLocked() && canResetSection('inventory')"
        (resetRequested)="onResetSection('inventory')"
      >
        <app-target-numeric-field
          label="План, % от выручки"
          inputId="targets-inventory"
          name="targets-inventory"
          suffix="%"
          [disabled]="isLocked()"
          [hintPrefix]="'факт ' + data().reference.label + ' ' + data().inventory.note"
          [value]="form().inventoryGoalPct"
          (valueChange)="updateInventoryGoalPct($event)"
        />
      </app-target-section>
    </div>
  `,
  styleUrl: './targets-form-organism.component.scss',
})
export class TargetsFormOrganismComponent {
  private readonly currency = inject(CurrencyService);

  readonly data = input.required<TargetsData>();
  readonly form = model.required<TargetsFormState>();

  readonly saved = output<TargetsFormState>();
  readonly saveRequested = output<TargetsFormState>();
  readonly clearRequested = output<void>();
  readonly lockRequested = output<void>();

  protected readonly saving = signal(false);
  protected readonly clearing = signal(false);
  protected readonly locking = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly successMessage = signal('Цели сохранены');
  protected readonly saveError = signal<string | null>(null);

  protected readonly currencySymbol = computed(() => {
    this.currency.code();
    return this.currency.symbol();
  });

  protected readonly writeoffModeOptions = computed(() => [
    { value: 'pct' as const, label: '%' },
    { value: 'rub' as const, label: this.currencySymbol() },
  ]);

  private readonly savedState = signal<TargetsFormState | null>(null);
  private syncedPeriodKey = '';

  protected readonly isLocked = computed(() => this.data().locked);

  protected readonly complimentsPlanAmount = computed(() =>
    complimentsAmountFromPlan(this.form().revenueMonthPlan, this.form().complimentsGoalPct),
  );

  /** Темп показываем только если прошлый месяц ещё не закрыт (pace ≠ fact). */
  protected readonly revenuePaceHint = computed(() => {
    const ref = this.data().reference;
    return ref.revenuePace !== ref.revenueFact ? ref.revenuePace : null;
  });

  protected readonly formValidation = computed(() => validateTargetsFormState(this.form()));

  protected readonly canSave = computed(() => this.formValidation().ok);

  protected readonly canClearMonth = computed(() => isTargetsMonthConfigured(this.data()));

  /** Замочек виден, если месяц настроен (есть что блокировать) или уже заблокирован. */
  protected readonly canLockMonth = computed(
    () => isTargetsMonthConfigured(this.data()) || this.data().locked,
  );

  protected readonly canResetAll = computed(() => {
    const saved = this.savedState();
    return saved != null && isTargetsFormDirty(this.form(), saved);
  });

  constructor() {
    effect(() => {
      const data = this.data();
      const form = this.form();
      const periodKey = `${data.period.year}-${data.period.month}`;
      if (periodKey === this.syncedPeriodKey && this.savedState() != null) {
        return;
      }
      untracked(() => {
        this.syncedPeriodKey = periodKey;
        this.savedState.set(cloneTargetsFormState(form));
        this.saveSuccess.set(false);
        this.saveError.set(null);
        this.locking.set(false);
      });
    });
  }

  canResetSection(section: TargetsFormSection): boolean {
    const saved = this.savedState();
    return saved != null && isTargetsSectionDirty(this.form(), saved, section);
  }

  onResetAll(): void {
    if (this.isLocked()) return;
    const saved = this.savedState();
    if (!saved) return;
    this.form.set(cloneTargetsFormState(saved));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  onResetSection(section: TargetsFormSection): void {
    if (this.isLocked()) return;
    const saved = this.savedState();
    if (!saved) return;
    this.form.set(restoreTargetsSection(this.form(), saved, section));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateRevenueMonthPlan(value: number): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({ ...state, revenueMonthPlan: value }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateWeekProfile(profile: number[]): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({ ...state, weekProfile: [...profile] }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateDailyPlanOverride(event: { day: number; amount: number | null }): void {
    if (this.isLocked()) return;
    this.form.update((state) => {
      const next = { ...state.dailyPlanOverrides };
      if (event.amount == null) {
        delete next[event.day];
      } else {
        next[event.day] = event.amount;
      }
      return { ...state, dailyPlanOverrides: next };
    });
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateFoodcostGoal(key: string, value: number): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({
      ...state,
      foodcostGoals: { ...state.foodcostGoals, [key]: value },
    }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  setWriteoffMode(key: string, mode: TargetsWriteoffMode): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({
      ...state,
      writeoffs: state.writeoffs.map((unit: TargetsWriteoffUnit) =>
        unit.key === key ? { ...unit, mode } : unit,
      ),
    }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateWriteoffPct(key: string, value: number): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({
      ...state,
      writeoffs: state.writeoffs.map((unit: TargetsWriteoffUnit) =>
        unit.key === key ? { ...unit, pct: value } : unit,
      ),
    }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateWriteoffRub(key: string, value: number): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({
      ...state,
      writeoffs: state.writeoffs.map((unit: TargetsWriteoffUnit) =>
        unit.key === key ? { ...unit, rub: value } : unit,
      ),
    }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateComplimentsGoalPct(value: number): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({ ...state, complimentsGoalPct: value }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  updateInventoryGoalPct(value: number): void {
    if (this.isLocked()) return;
    this.form.update((state) => ({ ...state, inventoryGoalPct: value }));
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  onSave(): void {
    if (this.isLocked()) return;
    const validation = validateTargetsFormState(this.form());
    if (!validation.ok) {
      this.saveSuccess.set(false);
      this.saveError.set(validation.message);
      return;
    }

    this.saving.set(true);
    this.clearing.set(false);
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.saveRequested.emit(cloneTargetsFormState(this.form()));
  }

  onClearMonth(): void {
    if (this.isLocked() || !this.canClearMonth()) return;
    const ok = confirm(
      'Очистить цели за выбранный месяц? Планы на дашборде и в фудкосте для этого месяца будут сняты.',
    );
    if (!ok) return;
    this.clearing.set(true);
    this.saving.set(false);
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.clearRequested.emit();
  }

  onLockMonth(): void {
    if (this.isLocked() || !this.canLockMonth()) return;
    if (this.canResetAll()) {
      const discard = confirm(
        'Есть несохранённые правки. Заблокировать сохранённую версию целей? Несохранённые изменения будут отброшены.',
      );
      if (!discard) return;
      this.onResetAll();
    }
    const ok = confirm(
      `Заблокировать цели за ${this.data().period.label}? Редактирование будет недоступно до разблокировки в Настройках.`,
    );
    if (!ok) return;
    this.locking.set(true);
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.lockRequested.emit();
  }

  markSaveSuccess(snapshot: TargetsFormState): void {
    this.savedState.set(cloneTargetsFormState(snapshot));
    this.saving.set(false);
    this.clearing.set(false);
    this.locking.set(false);
    this.successMessage.set('Цели сохранены');
    this.saveSuccess.set(true);
    this.saved.emit(snapshot);
  }

  markClearSuccess(snapshot: TargetsFormState): void {
    this.savedState.set(cloneTargetsFormState(snapshot));
    this.form.set(cloneTargetsFormState(snapshot));
    this.saving.set(false);
    this.clearing.set(false);
    this.locking.set(false);
    this.successMessage.set('Цели месяца очищены');
    this.saveSuccess.set(true);
    this.saved.emit(snapshot);
  }

  markLockSuccess(snapshot: TargetsFormState): void {
    this.savedState.set(cloneTargetsFormState(snapshot));
    this.form.set(cloneTargetsFormState(snapshot));
    this.saving.set(false);
    this.clearing.set(false);
    this.locking.set(false);
    this.successMessage.set('Цели заблокированы');
    this.saveSuccess.set(true);
    this.saved.emit(snapshot);
  }

  markSaveError(message: string): void {
    this.saving.set(false);
    this.clearing.set(false);
    this.locking.set(false);
    this.saveError.set(message);
  }
}

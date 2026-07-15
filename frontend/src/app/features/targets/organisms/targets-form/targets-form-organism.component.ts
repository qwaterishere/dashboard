import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';

import type {
  TargetsData,
  TargetsFormState,
  TargetsWriteoffMode,
  TargetsWriteoffUnit,
} from '../../../../shared/models/targets.model';
import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { FormBannerComponent } from '../../../../ui/molecules/form-banner/form-banner.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { complimentsAmountFromPlan } from '../../data/targets-form.utils';
import { MonthPlanCalendarComponent } from '../../molecules/month-plan-calendar/month-plan-calendar.component';
import { TargetNumericFieldComponent } from '../../molecules/target-numeric-field/target-numeric-field.component';
import { TargetSectionComponent } from '../../molecules/target-section/target-section.component';
import { WeekProfileGridComponent } from '../../molecules/week-profile-grid/week-profile-grid.component';
import { TargetFactHintComponent } from '../../molecules/target-fact-hint/target-fact-hint.component';

const WRITEOFF_MODE_OPTIONS = [
  { value: 'pct' as const, label: '%' },
  { value: 'rub' as const, label: '₽' },
];

@Component({
  selector: 'app-targets-form-organism',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    <div class="targets-form">
      <div class="targets-form__toolbar">
        <div class="targets-form__status">
          @if (saveSuccess()) {
            <app-form-banner variant="success" message="Цели сохранены" />
          }
        </div>
        <app-button variant="primary" [disabled]="saving()" (pressed)="onSave()">
          {{ saving() ? 'Сохранение…' : 'Сохранить' }}
        </app-button>
      </div>

      <app-target-section
        badge="01"
        title="Выручка — план по дням"
        description="сумма месяца распределяется профилем дней недели; дневные планы уезжают в plan графика на дашборде"
      >
        <app-target-numeric-field
          label="План на месяц, ₽"
          inputId="targets-revenue-plan"
          name="targets-revenue-plan"
          suffix="₽"
          [hintPrefix]="'факт ' + data().reference.label + ':'"
          [hintFactMoney]="data().reference.revenueFact"
          [hintPaceMoney]="data().reference.revenuePace"
          [value]="form().revenueMonthPlan"
          (valueChange)="updateRevenueMonthPlan($event)"
        />
        <app-week-profile-grid
          [profile]="form().weekProfile"
          (profileChange)="updateWeekProfile($event)"
        />
        <app-month-plan-calendar
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
      >
        <div class="targets-form__grid targets-form__grid--2">
          @for (unit of data().foodcost; track unit.key) {
            <app-target-numeric-field
              [label]="unit.name + ', %'"
              [inputId]="'targets-fc-' + unit.key"
              [name]="'targets-fc-' + unit.key"
              suffix="%"
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
      >
        <div class="targets-form__grid targets-form__grid--2">
          @for (unit of form().writeoffs; track unit.key) {
            <div class="targets-form__writeoff">
              <div class="targets-form__writeoff-head">
                <span class="targets-form__writeoff-name">{{ unit.name }}</span>
                <app-segment-control
                  size="sm"
                  [options]="writeoffModeOptions"
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
                  [value]="unit.pct"
                  (valueChange)="updateWriteoffPct(unit.key, $event)"
                />
              } @else {
                <app-target-numeric-field
                  label="План, ₽"
                  [inputId]="'targets-writeoff-rub-' + unit.key"
                  [name]="'targets-writeoff-rub-' + unit.key"
                  suffix="₽"
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
      >
        <app-target-numeric-field
          label="План, % от выручки"
          inputId="targets-compliments"
          name="targets-compliments"
          suffix="%"
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
      >
        <app-target-numeric-field
          label="План, % от выручки"
          inputId="targets-inventory"
          name="targets-inventory"
          suffix="%"
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
  readonly data = input.required<TargetsData>();
  readonly form = model.required<TargetsFormState>();

  readonly saved = output<TargetsFormState>();

  protected readonly saving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly writeoffModeOptions = WRITEOFF_MODE_OPTIONS;

  protected readonly complimentsPlanAmount = computed(() =>
    complimentsAmountFromPlan(this.form().revenueMonthPlan, this.form().complimentsGoalPct),
  );

  updateRevenueMonthPlan(value: number): void {
    this.form.update((state) => ({ ...state, revenueMonthPlan: value }));
  }

  updateWeekProfile(profile: number[]): void {
    this.form.update((state) => ({ ...state, weekProfile: [...profile] }));
  }

  updateDailyPlanOverride(event: { day: number; amount: number | null }): void {
    this.form.update((state) => {
      const next = { ...state.dailyPlanOverrides };
      if (event.amount == null) {
        delete next[event.day];
      } else {
        next[event.day] = event.amount;
      }
      return { ...state, dailyPlanOverrides: next };
    });
  }

  updateFoodcostGoal(key: string, value: number): void {
    this.form.update((state) => ({
      ...state,
      foodcostGoals: { ...state.foodcostGoals, [key]: value },
    }));
  }

  setWriteoffMode(key: string, mode: TargetsWriteoffMode): void {
    this.form.update((state) => ({
      ...state,
      writeoffs: state.writeoffs.map((unit: TargetsWriteoffUnit) =>
        unit.key === key ? { ...unit, mode } : unit,
      ),
    }));
  }

  updateWriteoffPct(key: string, value: number): void {
    this.form.update((state) => ({
      ...state,
      writeoffs: state.writeoffs.map((unit: TargetsWriteoffUnit) =>
        unit.key === key ? { ...unit, pct: value } : unit,
      ),
    }));
  }

  updateWriteoffRub(key: string, value: number): void {
    this.form.update((state) => ({
      ...state,
      writeoffs: state.writeoffs.map((unit: TargetsWriteoffUnit) =>
        unit.key === key ? { ...unit, rub: value } : unit,
      ),
    }));
  }

  updateComplimentsGoalPct(value: number): void {
    this.form.update((state) => ({ ...state, complimentsGoalPct: value }));
  }

  updateInventoryGoalPct(value: number): void {
    this.form.update((state) => ({ ...state, inventoryGoalPct: value }));
  }

  onSave(): void {
    this.saving.set(true);
    this.saveSuccess.set(false);
    window.setTimeout(() => {
      this.saving.set(false);
      this.saveSuccess.set(true);
      this.saved.emit(this.form());
    }, 450);
  }
}

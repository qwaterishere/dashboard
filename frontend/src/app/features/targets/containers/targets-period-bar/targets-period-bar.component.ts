import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';

import { ButtonComponent } from '../../../../ui/atoms/button/button.component';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { TextComponent } from '../../../../ui/atoms/text/text.component';
import { DatePillComponent } from '../../../../ui/molecules/date-pill/date-pill.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import type { SegmentOption } from '../../../../ui/molecules/segment-control/segment-control.model';
import { TargetsDataStore } from '../../data/targets-data.store';
import { TargetsPeriodService } from '../../data/targets-period.service';
import {
  currentCalendarMonth,
  formatTargetsMonthLabel,
  formatTargetsMonthShort,
  targetsYearBounds,
} from '../../data/targets-period.utils';

type TargetsQuickPreset = 'current' | 'other';

const QUICK_OPTIONS: SegmentOption<TargetsQuickPreset>[] = [
  { value: 'current', label: 'Текущий месяц' },
];

@Component({
  selector: 'app-targets-period-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePillComponent,
    ButtonComponent,
    HeadingComponent,
    TextComponent,
    SegmentControlComponent,
  ],
  templateUrl: './targets-period-bar.component.html',
  styleUrl: './targets-period-bar.component.scss',
})
export class TargetsPeriodBarComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly targetsPeriod = inject(TargetsPeriodService);
  private readonly store = inject(TargetsDataStore);

  protected readonly panelOpen = signal(false);
  protected readonly draftYear = signal(new Date().getFullYear());
  protected readonly monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  protected readonly quickOptions = QUICK_OPTIONS;

  protected readonly label = computed(() => {
    const fromStore = this.store.periodLabel();
    if (fromStore && fromStore !== '…') return fromStore;
    const selection = this.targetsPeriod.selection();
    if (!selection) return '…';
    return formatTargetsMonthLabel(selection.year, selection.month);
  });

  protected readonly note = computed(() => 'месяц целей');

  protected readonly yearBounds = computed(() =>
    targetsYearBounds(this.targetsPeriod.getPickerAnchorYear(), 2),
  );

  protected readonly selectedMonth = computed(() => this.targetsPeriod.selection()?.month ?? null);

  protected readonly selectedYear = computed(() => this.targetsPeriod.selection()?.year ?? null);

  protected readonly isCurrentMonth = computed(() => {
    const selection = this.targetsPeriod.selection();
    if (!selection) return false;
    const current = currentCalendarMonth();
    return selection.year === current.year && selection.month === current.month;
  });

  protected readonly quickValue = computed<TargetsQuickPreset>(() =>
    this.isCurrentMonth() ? 'current' : 'other',
  );

  protected readonly configuredMonthsInView = computed(() => {
    const year = this.draftYear();
    const keys = this.store.configuredKeys();
    const set = new Set<number>();
    for (let month = 1; month <= 12; month++) {
      if (keys.has(`${year}-${String(month).padStart(2, '0')}`)) {
        set.add(month);
      }
    }
    return set;
  });

  onQuickChange(value: TargetsQuickPreset): void {
    if (value === 'current') {
      this.targetsPeriod.selectCurrentMonth();
      this.panelOpen.set(false);
    }
  }

  togglePanel(): void {
    const next = !this.panelOpen();
    if (next) {
      const selection = this.targetsPeriod.selection();
      this.draftYear.set(selection?.year ?? this.targetsPeriod.getPickerAnchorYear());
      void this.store.refreshConfiguredMonths();
    }
    this.panelOpen.set(next);
  }

  shiftYear(delta: number): void {
    const bounds = this.yearBounds();
    const next = this.draftYear() + delta;
    if (next < bounds.minYear || next > bounds.maxYear) return;
    this.draftYear.set(next);
  }

  canPrevYear(): boolean {
    return this.draftYear() > this.yearBounds().minYear;
  }

  canNextYear(): boolean {
    return this.draftYear() < this.yearBounds().maxYear;
  }

  monthLabel(month: number): string {
    return formatTargetsMonthShort(month);
  }

  isMonthActive(month: number): boolean {
    return this.selectedYear() === this.draftYear() && this.selectedMonth() === month;
  }

  isMonthConfigured(month: number): boolean {
    return this.configuredMonthsInView().has(month);
  }

  selectMonth(month: number): void {
    this.targetsPeriod.setMonth(this.draftYear(), month);
    this.panelOpen.set(false);
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

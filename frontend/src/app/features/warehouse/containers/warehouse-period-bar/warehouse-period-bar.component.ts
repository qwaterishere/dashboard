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

import { DatePillComponent } from '../../../../ui/molecules/date-pill/date-pill.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import type { SegmentOption } from '../../../../ui/molecules/segment-control/segment-control.model';
import { WarehouseDataStore } from '../../data/warehouse-data.store';
import { WarehousePeriodService } from '../../data/warehouse-period.service';
import { formatWarehouseDayLabel } from '../../data/warehouse-period.utils';
import { WarehouseDayCalendarComponent } from '../../molecules/warehouse-day-calendar/warehouse-day-calendar.component';

type WarehouseQuickPreset = 'current' | 'other';

const QUICK_OPTIONS: SegmentOption<WarehouseQuickPreset>[] = [
  { value: 'current', label: 'Текущий день' },
];

@Component({
  selector: 'app-warehouse-period-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePillComponent, SegmentControlComponent, WarehouseDayCalendarComponent],
  templateUrl: './warehouse-period-bar.component.html',
  styleUrl: './warehouse-period-bar.component.scss',
})
export class WarehousePeriodBarComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly warehousePeriod = inject(WarehousePeriodService);
  private readonly store = inject(WarehouseDataStore);
  private readonly calendar = viewChild(WarehouseDayCalendarComponent);

  protected readonly panelOpen = signal(false);
  protected readonly quickOptions = QUICK_OPTIONS;

  protected readonly selection = this.warehousePeriod.selection;

  protected readonly isLatest = computed(() => this.selection() === null);

  protected readonly quickValue = computed<WarehouseQuickPreset>(() =>
    this.isLatest() ? 'current' : 'other',
  );

  protected readonly bounds = computed(() => {
    if (!this.store.data.hasValue()) {
      return {
        earliest: null as string | null,
        latest: null as string | null,
        availableDates: [] as string[],
      };
    }
    return this.store.data.value().dataBounds;
  });

  protected readonly label = computed(() => {
    const selected = this.selection();
    if (selected) return formatWarehouseDayLabel(selected);
    if (this.store.data.hasValue()) {
      return this.store.data.value().asOf.label;
    }
    const latest = this.bounds().latest;
    return latest ? formatWarehouseDayLabel(latest) : '…';
  });

  protected readonly note = computed(() =>
    this.isLatest() ? 'последний слепок' : 'слепок на конец дня',
  );

  protected readonly highlightIso = computed(() => {
    if (this.selection()) return null;
    if (this.store.data.hasValue()) return this.store.data.value().asOf.iso;
    return this.bounds().latest;
  });

  onQuickChange(value: WarehouseQuickPreset): void {
    if (value === 'current') {
      this.warehousePeriod.selectLatest();
      this.panelOpen.set(false);
    }
  }

  togglePanel(): void {
    const next = !this.panelOpen();
    this.panelOpen.set(next);
    if (next) {
      queueMicrotask(() => this.calendar()?.syncViewToSelection());
    }
  }

  onDaySelected(iso: string): void {
    const latest = this.bounds().latest;
    if (latest && iso === latest) {
      this.warehousePeriod.selectLatest();
    } else {
      this.warehousePeriod.setDay(iso);
    }
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

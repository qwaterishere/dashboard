import { Component, computed, input, model, signal } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { PositionsTableOrganismComponent, type PositionsSortKey } from '../positions-table/positions-table-organism.component';
import { computeAbcClasses, type AbcClass } from '../../../../shared/utils/abc-analysis.utils';
import type { AbcAxis, SalesPositionComputed } from '../../data/sales-aggregation.utils';

@Component({
  selector: 'app-abc-analysis-organism',
  standalone: true,
  imports: [HeadingComponent, SegmentControlComponent, PositionsTableOrganismComponent],
  template: `
    <div class="block">
      <div class="block-head">
        <app-heading [level]="2" text="Позиции · ABC-анализ" />
        <div class="pos-controls">
          <div class="abc-axis">
            Ось ABC:
            <app-segment-control
              [options]="axisOptions"
              [(value)]="axis"
            />
          </div>
        </div>
      </div>

      <div class="abc-summary">
        @for (pill of summary(); track pill.letter) {
          <button
            type="button"
            class="abc-pill"
            [class]="pill.letter"
            [class.off]="!filter()[pill.letter]"
            (click)="toggleFilter(pill.letter)"
          >
            <span class="dot"></span>
            <b>{{ pill.letter }}</b>
            <span class="meta">{{ pill.count }} поз · {{ pill.share }} % {{ axisLabel() }}</span>
          </button>
        }
      </div>

      <app-positions-table-organism
        [rows]="visibleRows()"
        [(sortKey)]="sortKey"
        [(sortDesc)]="sortDesc"
      />
    </div>
  `,
  styleUrl: './abc-analysis-organism.component.scss',
})
export class AbcAnalysisOrganismComponent {
  readonly positions = input.required<SalesPositionComputed[]>();
  readonly axis = model<AbcAxis>('gp');
  readonly filter = signal<Record<AbcClass, boolean>>({ A: true, B: true, C: true });
  readonly sortKey = model<PositionsSortKey>('gp');
  readonly sortDesc = model(true);

  protected readonly axisOptions = [
    { value: 'gp' as const, label: 'Вал. прибыль' },
    { value: 'rev' as const, label: 'Выручка' },
  ];

  private readonly classified = computed(() =>
    computeAbcClasses(this.positions(), this.axis()),
  );

  protected readonly summary = computed(() => {
    const rows = this.classified();
    const total = rows.reduce((sum, row) => sum + row[this.axis()], 0);
    const label = this.axis() === 'gp' ? 'прибыли' : 'выручки';

    return (['A', 'B', 'C'] as AbcClass[]).map((letter) => {
      const group = rows.filter((row) => row.abc === letter);
      const value = group.reduce((sum, row) => sum + row[this.axis()], 0);
      return {
        letter,
        count: group.length,
        share: total ? Math.round((value / total) * 100) : 0,
        label,
      };
    });
  });

  protected readonly visibleRows = computed((): (SalesPositionComputed & { abc: AbcClass })[] => {
    const active = this.filter();
    let rows = this.classified().filter((row) => active[row.abc]);
    const key = this.sortKey();
    const desc = this.sortDesc();

    rows = [...rows].sort((a, b) => {
      let result = 0;
      if (key === 'name') result = a.name.localeCompare(b.name);
      else if (key === 'abc') result = 'ABC'.indexOf(a.abc) - 'ABC'.indexOf(b.abc);
      else result = a[key] - b[key];
      return desc ? -result : result;
    });

    return rows;
  });

  axisLabel(): string {
    return this.axis() === 'gp' ? 'прибыли' : 'выручки';
  }

  toggleFilter(letter: AbcClass): void {
    this.filter.update((current) => {
      const next = { ...current, [letter]: !current[letter] };
      if (!Object.values(next).some(Boolean)) {
        next[letter] = true;
      }
      return next;
    });
  }
}

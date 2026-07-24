import { Component, computed, input, model, OnDestroy, signal } from '@angular/core';

import { CAT_NAME, CATEGORY_KEYS } from '../../../../shared/constants/category.constants';
import type { CategoryKey } from '../../../../shared/models';
import { MillionsPipe } from '../../../../shared/pipes/format.pipes';
import {
  computeAbcWithMeta,
  type AbcClass,
} from '../../../../shared/utils/abc-analysis.utils';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import type { AbcAxis, SalesPositionComputed } from '../../data/sales-aggregation.utils';
import {
  PositionsTableOrganismComponent,
  type PositionsSortKey,
  type PositionsTableRow,
} from '../positions-table/positions-table-organism.component';

type CategoryFilter = 'all' | CategoryKey;

interface AbcSummaryPill {
  letter: AbcClass;
  count: number;
  share: number;
  countShare: number;
  value: number;
}

const SEARCH_DEBOUNCE_MS = 200;
const CSV_FORMULA_RE = /^[=+\-@]/;
const PARETO_W = 320;
const PARETO_H = 120;
const PARETO_PAD = { top: 10, right: 8, bottom: 18, left: 28 };

@Component({
  selector: 'app-abc-analysis-organism',
  standalone: true,
  imports: [
    HeadingComponent,
    SegmentControlComponent,
    PositionsTableOrganismComponent,
    MillionsPipe,
  ],
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
              size="sm"
            />
          </div>
          <label class="abc-search">
            <span class="visually-hidden">Поиск позиции</span>
            <input
              type="search"
              placeholder="Поиск…"
              [value]="searchInput()"
              (input)="onSearchInput($event)"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <div class="abc-cat">
            <app-segment-control
              [options]="categoryOptions"
              [(value)]="category"
              size="sm"
            />
          </div>
        </div>
      </div>

      <div class="abc-summary">
        @for (pill of summary(); track pill.letter) {
          <button
            type="button"
            class="abc-pill"
            [class.A]="pill.letter === 'A'"
            [class.B]="pill.letter === 'B'"
            [class.C]="pill.letter === 'C'"
            [class.off]="!filter()[pill.letter]"
            (click)="toggleFilter(pill.letter)"
          >
            <span class="dot"></span>
            <b>{{ pill.letter }}</b>
            <span class="meta">
              {{ pill.count }} поз · {{ pill.share }} % {{ axisLabel() }}
              @if (pill.value) {
                · {{ pill.value | millions }}
              }
            </span>
          </button>
        }
      </div>

      @if (concentration(); as conc) {
        <div class="abc-viz" aria-label="Концентрация ABC">
          <div class="abc-viz__insight">
            <span class="abc-viz__eyebrow">Концентрация</span>
            <p class="abc-viz__headline">
              <b>A</b>
              · {{ conc.insight.countShare }}% позиций →
              <b>{{ conc.insight.valueShare }}%</b>
              {{ axisLabel() }}
            </p>
            <p class="abc-viz__sub">
              {{ conc.insight.count }} из {{ conc.totalCount }} SKU держат ядро
              {{ axis() === 'gp' ? 'прибыли' : 'выручки' }}
            </p>
          </div>

          <div class="abc-viz__bars">
            <div class="abc-stack">
              <div class="abc-stack__label">По {{ axisLabel() }}</div>
              <div class="abc-stack__track" role="img" [attr.aria-label]="valueBarAria(conc.segments)">
                @for (seg of conc.segments; track seg.letter) {
                  @if (seg.share > 0) {
                    <span
                      class="abc-stack__seg"
                      [class.abc-stack__seg--A]="seg.letter === 'A'"
                      [class.abc-stack__seg--B]="seg.letter === 'B'"
                      [class.abc-stack__seg--C]="seg.letter === 'C'"
                      [style.flex-grow]="seg.share"
                      [attr.title]="seg.letter + ': ' + seg.share + '%'"
                    ></span>
                  }
                }
              </div>
              <div class="abc-stack__legend">
                @for (seg of conc.segments; track seg.letter) {
                  <span
                    [class.abc-stack__leg]="true"
                    [class.abc-stack__leg--A]="seg.letter === 'A'"
                    [class.abc-stack__leg--B]="seg.letter === 'B'"
                    [class.abc-stack__leg--C]="seg.letter === 'C'"
                  >
                    {{ seg.letter }} {{ seg.share }}%
                  </span>
                }
              </div>
            </div>

            <div class="abc-stack">
              <div class="abc-stack__label">По числу позиций</div>
              <div class="abc-stack__track" role="img" [attr.aria-label]="countBarAria(conc.segments)">
                @for (seg of conc.segments; track seg.letter) {
                  @if (seg.countShare > 0) {
                    <span
                      class="abc-stack__seg"
                      [class.abc-stack__seg--A]="seg.letter === 'A'"
                      [class.abc-stack__seg--B]="seg.letter === 'B'"
                      [class.abc-stack__seg--C]="seg.letter === 'C'"
                      [style.flex-grow]="seg.countShare"
                      [attr.title]="seg.letter + ': ' + seg.countShare + '% поз'"
                    ></span>
                  }
                }
              </div>
              <div class="abc-stack__legend">
                @for (seg of conc.segments; track seg.letter) {
                  <span
                    [class.abc-stack__leg]="true"
                    [class.abc-stack__leg--A]="seg.letter === 'A'"
                    [class.abc-stack__leg--B]="seg.letter === 'B'"
                    [class.abc-stack__leg--C]="seg.letter === 'C'"
                  >
                    {{ seg.letter }} {{ seg.countShare }}%
                  </span>
                }
              </div>
            </div>
          </div>

          <div class="abc-pareto">
            <div class="abc-pareto__label">Кривая Парето</div>
            <svg
              class="abc-pareto__svg"
              [attr.viewBox]="'0 0 ' + paretoW + ' ' + paretoH"
              role="img"
              [attr.aria-label]="
                'Кумулятивная доля ' + axisLabel() + ' по рангу позиций с порогами 80% и 95%'
              "
            >
              <line
                class="abc-pareto__grid"
                [attr.x1]="paretoPad.left"
                [attr.x2]="paretoW - paretoPad.right"
                [attr.y1]="yAt(0.8)"
                [attr.y2]="yAt(0.8)"
              />
              <line
                class="abc-pareto__grid"
                [attr.x1]="paretoPad.left"
                [attr.x2]="paretoW - paretoPad.right"
                [attr.y1]="yAt(0.95)"
                [attr.y2]="yAt(0.95)"
              />
              <text class="abc-pareto__mark" [attr.x]="paretoPad.left - 4" [attr.y]="yAt(0.8) + 3">
                80
              </text>
              <text class="abc-pareto__mark" [attr.x]="paretoPad.left - 4" [attr.y]="yAt(0.95) + 3">
                95
              </text>
              <path class="abc-pareto__area" [attr.d]="conc.paretoArea" />
              <polyline class="abc-pareto__line" [attr.points]="conc.paretoLine" />
              <text
                class="abc-pareto__axis"
                [attr.x]="paretoPad.left"
                [attr.y]="paretoH - 4"
              >
                ранг →
              </text>
              <text
                class="abc-pareto__axis abc-pareto__axis--end"
                [attr.x]="paretoW - paretoPad.right"
                [attr.y]="paretoH - 4"
              >
                100% SKU
              </text>
            </svg>
          </div>
        </div>
      }

      <app-positions-table-organism
        [rows]="visibleRows()"
        [(sortKey)]="sortKey"
        [(sortDesc)]="sortDesc"
      />

      @if (!filter().C && cSummary(); as c) {
        <div class="abc-c-collapse" role="status">
          <div class="abc-c-collapse__text">
            <b>C</b>
            · {{ c.count }} поз · {{ c.share }} % {{ axisLabel() }}
            @if (c.value) {
              · {{ c.value | millions }}
            }
          </div>
          <div class="abc-c-collapse__actions">
            <button type="button" class="abc-c-btn" (click)="showClassC()">Показать</button>
            <button type="button" class="abc-c-btn abc-c-btn--ghost" (click)="downloadClassCCsv()">
              Скачать CSV
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './abc-analysis-organism.component.scss',
})
export class AbcAnalysisOrganismComponent implements OnDestroy {
  readonly positions = input.required<SalesPositionComputed[]>();
  readonly axis = model<AbcAxis>('gp');
  readonly filter = signal<Record<AbcClass, boolean>>({ A: true, B: true, C: true });
  readonly category = model<CategoryFilter>('all');
  readonly sortKey = model<PositionsSortKey>('gp');
  readonly sortDesc = model(true);

  protected readonly searchInput = signal('');
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly paretoW = PARETO_W;
  protected readonly paretoH = PARETO_H;
  protected readonly paretoPad = PARETO_PAD;

  protected readonly axisOptions = [
    { value: 'gp' as const, label: 'Вал. прибыль' },
    { value: 'rev' as const, label: 'Выручка' },
  ];

  protected readonly categoryOptions = [
    { value: 'all' as const, label: 'Все' },
    ...CATEGORY_KEYS.map((key) => ({ value: key, label: CAT_NAME[key] })),
  ];

  private readonly classified = computed((): PositionsTableRow[] =>
    computeAbcWithMeta(this.positions(), this.axis()),
  );

  protected readonly summary = computed((): AbcSummaryPill[] => {
    const rows = this.classified();
    const totalValue = rows.reduce((sum, row) => sum + row[this.axis()], 0);
    const totalCount = rows.length;

    return (['A', 'B', 'C'] as AbcClass[]).map((letter) => {
      const group = rows.filter((row) => row.abc === letter);
      const value = group.reduce((sum, row) => sum + row[this.axis()], 0);
      return {
        letter,
        count: group.length,
        share: totalValue ? Math.round((value / totalValue) * 100) : 0,
        countShare: totalCount ? Math.round((group.length / totalCount) * 100) : 0,
        value,
      };
    });
  });

  protected readonly cSummary = computed(() => {
    return this.summary().find((pill) => pill.letter === 'C') ?? null;
  });

  protected readonly concentration = computed(() => {
    const rows = this.classified();
    const segments = this.summary();
    const totalCount = rows.length;
    const a = segments.find((seg) => seg.letter === 'A');

    if (!totalCount || !a) {
      return null;
    }

    const { paretoLine, paretoArea } = buildParetoPaths(rows);

    return {
      segments,
      totalCount,
      insight: {
        count: a.count,
        countShare: a.countShare,
        valueShare: a.share,
      },
      paretoLine,
      paretoArea,
    };
  });

  protected readonly visibleRows = computed((): PositionsTableRow[] => {
    const active = this.filter();
    const query = this.searchQuery();
    const cat = this.category();
    let rows = this.classified().filter((row) => active[row.abc]);

    if (cat !== 'all') {
      rows = rows.filter((row) => row.cat === cat);
    }

    if (query) {
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(query) || row.sub.toLowerCase().includes(query),
      );
    }

    const key = this.sortKey();
    const desc = this.sortDesc();

    rows = [...rows].sort((a, b) => {
      const cmp =
        key === 'name'
          ? a.name.localeCompare(b.name)
          : key === 'abc'
            ? 'ABC'.indexOf(a.abc) - 'ABC'.indexOf(b.abc)
            : a[key] - b[key];
      return desc ? -cmp : cmp;
    });

    return rows;
  });

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  axisLabel(): string {
    return this.axis() === 'gp' ? 'прибыли' : 'выручки';
  }

  yAt(share: number): number {
    const plotH = PARETO_H - PARETO_PAD.top - PARETO_PAD.bottom;
    return PARETO_PAD.top + plotH * (1 - share);
  }

  valueBarAria(segments: AbcSummaryPill[]): string {
    return segments.map((seg) => `${seg.letter} ${seg.share}%`).join(', ');
  }

  countBarAria(segments: AbcSummaryPill[]): string {
    return segments.map((seg) => `${seg.letter} ${seg.countShare}% позиций`).join(', ');
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchQuery.set(value.trim().toLowerCase());
      this.searchTimer = null;
    }, SEARCH_DEBOUNCE_MS);
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

  showClassC(): void {
    this.filter.update((current) => ({ ...current, C: true }));
  }

  downloadClassCCsv(): void {
    const axis = this.axis();
    const rows = this.classified().filter((row) => row.abc === 'C');
    const header = ['rank', 'name', 'sub', 'cat', 'abc', 'qty', 'rev', 'gp', 'fc', 'share', 'cumShare'];
    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.rank,
          csvCell(row.name),
          csvCell(row.sub),
          csvCell(CAT_NAME[row.cat]),
          row.abc,
          row.qty,
          row.rev,
          row.gp,
          row.fc.toFixed(2),
          row.share.toFixed(2),
          row.cumShare.toFixed(2),
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `abc-class-c-${axis}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function csvCell(value: string): string {
  const escaped = value.replaceAll('"', '""');
  const safe = CSV_FORMULA_RE.test(escaped) ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

function buildParetoPaths(rows: PositionsTableRow[]): { paretoLine: string; paretoArea: string } {
  const plotW = PARETO_W - PARETO_PAD.left - PARETO_PAD.right;
  const plotH = PARETO_H - PARETO_PAD.top - PARETO_PAD.bottom;
  const n = rows.length;

  const pointAt = (index: number, cumShare: number): string => {
    const x = PARETO_PAD.left + (n <= 1 ? plotW : (index / (n - 1)) * plotW);
    const y = PARETO_PAD.top + plotH * (1 - cumShare / 100);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  if (n === 0) {
    return { paretoLine: '', paretoArea: '' };
  }

  // Downsample long menus for a smooth SVG without thousands of points.
  const maxPoints = 96;
  const step = Math.max(1, Math.ceil(n / maxPoints));
  const indices: number[] = [];
  for (let i = 0; i < n; i += step) {
    indices.push(i);
  }
  if (indices[indices.length - 1] !== n - 1) {
    indices.push(n - 1);
  }

  const points = indices.map((i) => pointAt(i, rows[i].cumShare));
  const start = `${PARETO_PAD.left},${(PARETO_PAD.top + plotH).toFixed(1)}`;
  const endBase = `${(PARETO_PAD.left + plotW).toFixed(1)},${(PARETO_PAD.top + plotH).toFixed(1)}`;
  const paretoLine = points.join(' ');
  const paretoArea = `M${start} L${paretoLine} L${endBase} Z`;

  return { paretoLine, paretoArea };
}

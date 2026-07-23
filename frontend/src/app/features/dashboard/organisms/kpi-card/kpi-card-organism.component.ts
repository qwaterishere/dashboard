import { Component, input } from '@angular/core';

import { LabelComponent } from '../../../../ui/atoms/label/label.component';
import { KpiValueComponent } from '../../../../ui/molecules/kpi-value/kpi-value.component';
import { GoalTrackComponent } from '../../../../ui/molecules/goal-track/goal-track.component';
import { WeekKpiFooterComponent } from '../../../../ui/molecules/week-kpi-footer/week-kpi-footer.component';
import type { DetailPopover, LflDirection } from '../../../../shared/models';
import type { KpiBlock } from '../../../../shared/models/dashboard.model';

export type KpiTone = 'kpi-rev' | 'kpi-check' | 'kpi-guests';

@Component({
  selector: 'app-kpi-card-organism',
  standalone: true,
  imports: [LabelComponent, KpiValueComponent, GoalTrackComponent, WeekKpiFooterComponent],
  template: `
    <div class="kpi" [class]="modifierClass()">
      <div class="k-top">
        <app-label [tone]="tone()">{{ heading() }}</app-label>
      </div>
      <app-kpi-value
        [value]="value()"
        [format]="valueFormat()"
        [lflPct]="lflPct()"
        [lflDir]="lflDir()"
        [comparisonLabel]="comparisonLabel()"
        [lflLoading]="lflLoading()"
        [lflPopoverKey]="lflPopoverKey()"
        [popoverDetails]="popoverDetails()"
      />
      <p class="k-sub"><ng-content select="[subtext]" /></p>
      <div class="kpi__forecast">
        @if (weekFooter(); as footer) {
          <app-week-kpi-footer
            [label]="footer.label"
            [headline]="footer.headline"
            [popoverKey]="footer.popoverKey"
            [popoverDetails]="popoverDetails()"
          />
        } @else if (showForecast()) {
          <app-goal-track
            [label]="forecastLabel()"
            [headline]="forecastHeadline()"
            [trackPct]="trackPct()"
            [planPct]="planPct()"
            [risk]="risk()"
            [goalPopoverKey]="goalPopoverKey()"
            [popoverDetails]="popoverDetails()"
          />
        } @else {
          <div class="kpi__forecast-placeholder" aria-hidden="true"></div>
        }
      </div>
    </div>
  `,
  styleUrl: './kpi-card-organism.component.scss',
})
export class KpiCardOrganismComponent {
  /** Не `title`: иначе браузер рисует native tooltip на host. */
  readonly heading = input.required<string>();
  readonly tone = input<KpiTone>('kpi-rev');
  readonly value = input.required<number>();
  readonly valueFormat = input<'money' | 'number'>('money');
  readonly lflPct = input<number | undefined>();
  readonly lflDir = input<LflDirection | undefined>();
  readonly comparisonLabel = input<'LfL' | 'WoW'>('LfL');
  readonly lflLoading = input(false);
  readonly forecastHeadline = input.required<string>();
  readonly forecastLabel = input('Прогноз на конец месяца');
  readonly trackPct = input.required<number>();
  readonly planPct = input(0);
  readonly risk = input(false);
  readonly lflPopoverKey = input<string | undefined>();
  readonly goalPopoverKey = input<string | undefined>();
  readonly popoverDetails = input<Record<string, DetailPopover>>({});
  readonly showForecast = input(true);
  readonly weekFooter = input<KpiBlock['weekFooter']>();

  modifierClass(): string {
    const map: Record<KpiTone, string> = {
      'kpi-rev': 'm-rev',
      'kpi-check': 'm-check',
      'kpi-guests': 'm-guests',
    };
    return map[this.tone()];
  }
}

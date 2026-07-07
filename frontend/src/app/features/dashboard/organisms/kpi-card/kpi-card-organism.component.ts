import { Component, input } from '@angular/core';

import { LabelComponent } from '../../../../ui/atoms/label/label.component';
import { KpiValueComponent } from '../../../../ui/molecules/kpi-value/kpi-value.component';
import { GoalTrackComponent } from '../../../../ui/molecules/goal-track/goal-track.component';
import type { DetailPopover, LflDirection } from '../../../../shared/models';

export type KpiTone = 'kpi-rev' | 'kpi-check' | 'kpi-guests';

@Component({
  selector: 'app-kpi-card-organism',
  standalone: true,
  imports: [LabelComponent, KpiValueComponent, GoalTrackComponent],
  template: `
    <div class="kpi" [class]="modifierClass()">
      <div class="k-top">
        <app-label [tone]="tone()">{{ title() }}</app-label>
      </div>
      <app-kpi-value
        [value]="value()"
        [format]="valueFormat()"
        [lflPct]="lflPct()"
        [lflDir]="lflDir()"
        [lflPopoverKey]="lflPopoverKey()"
        [popoverDetails]="popoverDetails()"
      />
      <p class="k-sub"><ng-content select="[subtext]" /></p>
      <app-goal-track
        [headline]="forecastHeadline()"
        [trackPct]="trackPct()"
        [risk]="risk()"
        [goalPopoverKey]="goalPopoverKey()"
        [popoverDetails]="popoverDetails()"
      />
    </div>
  `,
  styleUrl: './kpi-card-organism.component.scss',
})
export class KpiCardOrganismComponent {
  readonly title = input.required<string>();
  readonly tone = input<KpiTone>('kpi-rev');
  readonly value = input.required<number>();
  readonly valueFormat = input<'money' | 'number'>('money');
  readonly lflPct = input<number | undefined>();
  readonly lflDir = input<LflDirection | undefined>();
  readonly forecastHeadline = input.required<string>();
  readonly trackPct = input.required<number>();
  readonly risk = input(false);
  readonly lflPopoverKey = input<string | undefined>();
  readonly goalPopoverKey = input<string | undefined>();
  readonly popoverDetails = input<Record<string, DetailPopover>>({});

  modifierClass(): string {
    const map: Record<KpiTone, string> = {
      'kpi-rev': 'm-rev',
      'kpi-check': 'm-check',
      'kpi-guests': 'm-guests',
    };
    return map[this.tone()];
  }
}

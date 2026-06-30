import { Component, input } from '@angular/core';

@Component({
  selector: 'app-label',
  standalone: true,
  template: `<span [class]="classes()"><ng-content /></span>`,
  styles: `
    .label { font-weight: 600; color: var(--txt); }
    .label--muted { color: var(--mut); font-weight: 500; }
    .label--kpi-title {
      font-weight: 700;
      font-size: 0.93rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .label--kpi-title::before {
      content: '';
      width: 3px;
      height: 13px;
      border-radius: 2px;
      background: var(--mut2);
    }
    .label--kpi-rev::before { background: var(--grn); }
    .label--kpi-check::before { background: var(--vio); }
    .label--kpi-guests::before { background: #46c2b6; }
  `,
})
export class LabelComponent {
  readonly tone = input<'default' | 'muted' | 'kpi-rev' | 'kpi-check' | 'kpi-guests'>('default');

  classes(): string {
    if (this.tone().startsWith('kpi-')) return `label label--kpi-title label--${this.tone()}`;
    if (this.tone() === 'muted') return 'label label--muted';
    return 'label';
  }
}

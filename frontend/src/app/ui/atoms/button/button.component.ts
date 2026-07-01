import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button [class]="classes()" [type]="type()" [disabled]="disabled()" (click)="pressed.emit()">
      <ng-content />
    </button>
  `,
  styles: `
    button {
      font-family: inherit;
      cursor: pointer;
      border: 0;
      background: none;
      color: var(--mut);
      font-size: 0.76rem;
      font-weight: 600;
      padding: 6px 13px;
      border-radius: 8px;
      transition: all 0.15s;
    }
    button:hover:not(:disabled) {
      color: var(--txt);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.btn--segment-on {
      background: linear-gradient(90deg, rgba(110, 107, 255, 0.35), rgba(61, 220, 151, 0.22));
      color: #fff;
      box-shadow: inset 0 0 0 1px rgba(110, 107, 255, 0.4);
    }
    button.btn--pill {
      background: var(--card2);
      border: 1px solid var(--line);
      color: var(--mut);
      font-size: 0.74rem;
      border-radius: 99px;
      padding: 6px 13px;
    }
  `,
})
export class ButtonComponent {
  readonly variant = input<'default' | 'segment-on' | 'pill'>('default');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly pressed = output<void>();

  classes(): string {
    const v = this.variant();
    if (v === 'segment-on') return 'btn--segment-on';
    if (v === 'pill') return 'btn--pill';
    return '';
  }
}

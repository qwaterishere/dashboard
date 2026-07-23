import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../atoms/button/button.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #root
      class="confirm"
      role="presentation"
      (click)="onBackdropClick($event)"
    >
      <div
        class="confirm__panel"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="messageId"
        (click)="$event.stopPropagation()"
      >
        <h4 class="confirm__title" [id]="titleId">{{ title() }}</h4>
        <p class="confirm__message" [id]="messageId">{{ message() }}</p>
        <div class="confirm__actions">
          <app-button variant="pill" (pressed)="cancelled.emit()">{{ cancelLabel() }}</app-button>
          <app-button [variant]="confirmVariant()" (pressed)="confirmed.emit()">
            {{ confirmLabel() }}
          </app-button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .confirm {
      position: fixed;
      inset: 0;
      z-index: 120;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.45);
    }

    .confirm__panel {
      width: min(320px, 100%);
      padding: 18px 18px 16px;
      border-radius: 14px;
      border: 1px solid rgba(110, 107, 255, 0.45);
      background: var(--popover-bg);
      box-shadow: var(--popover-shadow);
      display: grid;
      gap: 10px;
    }

    .confirm__title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 800;
      color: var(--txt);
    }

    .confirm__message {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--mut);
      line-height: 1.45;
    }

    .confirm__actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 6px;
    }

    .confirm__actions app-button {
      display: block;
    }

    .confirm__actions ::ng-deep button {
      width: 100%;
    }
  `,
})
export class ConfirmDialogComponent {
  private static nextId = 0;

  private readonly destroyRef = inject(DestroyRef);
  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private portalEl: HTMLElement | null = null;

  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Подтвердить');
  readonly cancelLabel = input('Отмена');
  readonly confirmVariant = input<'danger' | 'primary' | 'pill'>('danger');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = `confirm-title-${ConfirmDialogComponent.nextId}`;
  protected readonly messageId = `confirm-message-${ConfirmDialogComponent.nextId++}`;

  constructor() {
    queueMicrotask(() => this.attachToBody());
    this.destroyRef.onDestroy(() => this.portalEl?.remove());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelled.emit();
    }
  }

  private attachToBody(): void {
    const el = this.root().nativeElement;
    this.portalEl = el;
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  }
}

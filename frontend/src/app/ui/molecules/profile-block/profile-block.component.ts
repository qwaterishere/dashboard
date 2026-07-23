import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../atoms/button/button.component';
import { TextComponent } from '../../atoms/text/text.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

const NOTIF_PANEL_WIDTH_PX = 168;
const NOTIF_PANEL_GAP_PX = 8;

@Component({
  selector: 'app-profile-block',
  standalone: true,
  imports: [ButtonComponent, TextComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="profile-wrap">
      <div class="profile">
        <div class="notif">
          <button
            #notifBtn
            type="button"
            class="icon-btn"
            [attr.aria-expanded]="notifOpen()"
            aria-haspopup="dialog"
            aria-label="Уведомления"
            (click)="toggleNotif($event)"
          >
            @if (hasUnread()) {
              <span class="ndot" aria-hidden="true"></span>
            }
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 9a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
              <path d="M10 20a2 2 0 004 0" />
            </svg>
          </button>
        </div>
        <div class="ava">{{ initials() }}</div>
        <div class="who">
          <b>{{ name() }}</b>
          <app-text tone="muted">{{ role() }}</app-text>
        </div>
      </div>
      @if (showLogout()) {
        <app-button class="logout" variant="pill" [block]="true" (pressed)="openLogoutConfirm()">
          Выйти
        </app-button>
      }
    </div>

    @if (notifOpen()) {
      <div
        #notifPanel
        class="notif__panel"
        role="dialog"
        aria-label="Уведомления"
        [style.top.px]="notifTop()"
        [style.left.px]="notifLeft()"
      >
        <p class="notif__empty">Нет уведомлений</p>
      </div>
    }

    @if (logoutConfirmOpen()) {
      <app-confirm-dialog
        title="Выйти?"
        message="Сессия будет завершена. Продолжить?"
        confirmLabel="Выйти"
        cancelLabel="Отмена"
        confirmVariant="danger"
        (confirmed)="confirmLogout()"
        (cancelled)="logoutConfirmOpen.set(false)"
      />
    }
  `,
  styles: `
    .profile-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 24px;
    }

    .profile {
      display: flex;
      align-items: center;
      gap: 11px;
      justify-content: flex-end;
    }

    .logout {
      width: 100%;
    }

    .notif {
      position: relative;
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--mut);
      display: grid;
      place-items: center;
      position: relative;
      padding: 0;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;

      &:hover {
        color: var(--txt);
        border-color: rgba(110, 107, 255, 0.45);
      }

      &:focus-visible {
        outline: 2px solid var(--vio);
        outline-offset: 2px;
      }
    }
    .icon-btn svg {
      width: 16px;
      height: 16px;
    }
    .ndot {
      position: absolute;
      top: 8px;
      right: 9px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--grn);
      box-shadow: 0 0 6px var(--grn);
    }

    .notif__panel {
      position: fixed;
      z-index: 110;
      width: ${NOTIF_PANEL_WIDTH_PX}px;
      min-height: 88px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid rgba(110, 107, 255, 0.45);
      background: var(--popover-bg);
      box-shadow: var(--popover-shadow);
      display: grid;
      place-items: center;
      text-align: center;

      &::before {
        content: '';
        position: absolute;
        top: -6px;
        right: 12px;
        width: 10px;
        height: 10px;
        background: var(--popover-bg);
        border-left: 1px solid rgba(110, 107, 255, 0.45);
        border-top: 1px solid rgba(110, 107, 255, 0.45);
        transform: rotate(45deg);
      }
    }

    .notif__empty {
      margin: 0;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--mut);
      line-height: 1.4;
    }

    .ava {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      flex: none;
      background: linear-gradient(135deg, var(--vio), var(--grn));
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 0.85rem;
      color: #0a0e18;
    }
    .who b {
      font-size: 0.84rem;
      display: block;
    }
    .who app-text {
      display: block;
    }
  `,
})
export class ProfileBlockComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifBtn = viewChild.required<ElementRef<HTMLButtonElement>>('notifBtn');
  private readonly notifPanel = viewChild<ElementRef<HTMLElement>>('notifPanel');

  readonly initials = input.required<string>();
  readonly name = input.required<string>();
  readonly role = input('');
  readonly showLogout = input(true);
  /** Green unread indicator — off until notifications exist. */
  readonly hasUnread = input(false);
  readonly logout = output<void>();

  protected readonly notifOpen = signal(false);
  protected readonly notifTop = signal(0);
  protected readonly notifLeft = signal(0);
  protected readonly logoutConfirmOpen = signal(false);

  constructor() {
    const onScroll = (): void => this.onViewportChange();
    document.addEventListener('scroll', onScroll, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, true);
      this.notifOpen.set(false);
      this.logoutConfirmOpen.set(false);
    });
  }

  openLogoutConfirm(): void {
    this.notifOpen.set(false);
    this.logoutConfirmOpen.set(true);
  }

  confirmLogout(): void {
    this.logoutConfirmOpen.set(false);
    this.logout.emit();
  }

  toggleNotif(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.notifOpen();
    if (next) {
      this.logoutConfirmOpen.set(false);
      this.repositionNotifPanel();
      this.notifOpen.set(true);
      queueMicrotask(() => this.attachPanelToBody());
    } else {
      this.notifOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notifOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (this.host.nativeElement.contains(target)) return;
    if (this.notifPanel()?.nativeElement.contains(target)) return;
    this.notifOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.logoutConfirmOpen()) {
      this.logoutConfirmOpen.set(false);
      return;
    }
    if (this.notifOpen()) {
      this.notifOpen.set(false);
    }
  }

  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.notifOpen()) {
      this.repositionNotifPanel();
    }
  }

  private attachPanelToBody(): void {
    const panel = this.notifPanel()?.nativeElement;
    if (panel && panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  }

  private repositionNotifPanel(): void {
    const rect = this.notifBtn().nativeElement.getBoundingClientRect();
    this.notifTop.set(rect.bottom + NOTIF_PANEL_GAP_PX);
    this.notifLeft.set(Math.max(8, rect.right - NOTIF_PANEL_WIDTH_PX));
  }
}

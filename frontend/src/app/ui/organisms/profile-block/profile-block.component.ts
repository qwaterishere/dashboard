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
import { RouterLink } from '@angular/router';

import { AvatarComponent } from '../../atoms/avatar/avatar.component';
import { ButtonComponent } from '../../atoms/button/button.component';
import { TextComponent } from '../../atoms/text/text.component';
import { ConfirmDialogComponent } from '../../molecules/confirm-dialog/confirm-dialog.component';
import { ThemeToggleComponent } from '../../molecules/theme-toggle/theme-toggle.component';

const NOTIF_PANEL_WIDTH_PX = 240;
const NOTIF_PANEL_GAP_PX = 8;

export interface ProfileNotificationItem {
  id: string;
  message: string;
  link: string | null;
  fragment: string | null;
  queryParams?: Record<string, string> | null;
}

/**
 * Organism: profile chrome — avatar identity + theme + notifications + logout.
 * Presentational; theme/logout wired by shell container.
 */
@Component({
  selector: 'app-profile-block',
  standalone: true,
  imports: [
    AvatarComponent,
    ButtonComponent,
    TextComponent,
    ConfirmDialogComponent,
    ThemeToggleComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="profile-wrap">
      <div class="profile">
        <div class="profile__identity">
          <app-avatar [initials]="initials()" />
          <div class="who">
            <b>{{ name() }}</b>
            @if (role()) {
              <app-text tone="muted">{{ role() }}</app-text>
            }
          </div>
        </div>

        <div class="profile__tools" role="group" aria-label="Действия">
          <app-theme-toggle
            variant="icon"
            [isDark]="isDark()"
            (toggled)="themeToggled.emit()"
          />
          <div class="notif">
            <button
              #notifBtn
              type="button"
              class="icon-btn notif-btn"
              [attr.aria-expanded]="notifOpen()"
              aria-haspopup="dialog"
              [attr.aria-label]="notifAriaLabel()"
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
        @if (notifications().length === 0) {
          <p class="notif__empty">Нет уведомлений</p>
        } @else {
          <ul class="notif__list">
            @for (item of notifications(); track item.id) {
              <li>
                @if (item.link) {
                  <a
                    class="notif__item"
                    [routerLink]="item.link"
                    [queryParams]="item.queryParams ?? undefined"
                    [fragment]="item.fragment ?? undefined"
                    (click)="notifOpen.set(false)"
                  >
                    {{ item.message }}
                  </a>
                } @else {
                  <p class="notif__item notif__item--static">{{ item.message }}</p>
                }
              </li>
            }
          </ul>
        }
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
      gap: 12px;
      width: 100%;
      margin-bottom: 24px;
    }

    .profile {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      min-width: 0;
    }

    .profile__identity {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1 1 auto;
    }

    .profile__tools {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: none;
      margin-inline-start: 4px;
    }

    .logout {
      width: 100%;
    }

    .notif {
      position: relative;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--mut);
      display: grid;
      place-items: center;
      position: relative;
      padding: 0;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s, background 0.15s;

      &:hover {
        color: var(--txt);
        border-color: rgba(110, 107, 255, 0.45);
        background: var(--card2, var(--card));
      }

      &:focus-visible {
        outline: 2px solid var(--vio);
        outline-offset: 2px;
      }
    }

    .icon-btn svg {
      width: 15px;
      height: 15px;
    }

    .ndot {
      position: absolute;
      top: 7px;
      right: 8px;
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
      max-height: min(360px, 70vh);
      overflow-y: auto;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(110, 107, 255, 0.45);
      background: var(--popover-bg);
      box-shadow: var(--popover-shadow);

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
      padding: 18px 8px;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--mut);
      line-height: 1.4;
      text-align: center;
    }

    .notif__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .notif__item {
      display: block;
      margin: 0;
      padding: 8px 6px;
      border-radius: 8px;
      font-size: 0.74rem;
      font-weight: 650;
      line-height: 1.35;
      color: var(--txt);
      text-decoration: none;
      text-align: left;

      &:hover {
        background: var(--nav-hover-bg);
      }

      &:focus-visible {
        outline: 2px solid var(--vio);
        outline-offset: 1px;
      }
    }

    .notif__item--static {
      color: var(--mut);
      font-weight: 600;
    }

    .who {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .who b {
      font-size: 0.84rem;
      line-height: 1.25;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .who app-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
  readonly notifications = input<ProfileNotificationItem[]>([]);
  readonly hasUnread = input(false);
  readonly isDark = input(false);
  readonly logout = output<void>();
  readonly themeToggled = output<void>();

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

  protected notifAriaLabel(): string {
    const n = this.notifications().length;
    if (n === 0) return 'Уведомления';
    return `Уведомления, ${n}`;
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

/**
 * Molecule: data-trust strip for «Данные» section.
 * Presentational — TrustStripVm only.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ATTENTION_TONE_COLOR } from '../../../shared/constants/attention-tone.constants';
import type { AppStatusTone, TrustStripVm } from '../../../shared/utils/restaurant-attention.utils';
import { ButtonComponent } from '../../atoms/button/button.component';
import { DotComponent } from '../../atoms/dot/dot.component';
import { ProgressFillComponent } from '../../atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../atoms/progress-track/progress-track.component';

@Component({
  selector: 'app-trust-strip',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    DotComponent,
    ProgressTrackComponent,
    ProgressFillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (trust(); as t) {
      @if (!t.expanded) {
        <p class="trust trust--compact">
          <span class="trust__dot-wrap" aria-hidden="true">
            <app-dot size="sm" [color]="dotColor(t.tone)" />
          </span>
          {{ t.compactLabel }}
        </p>
      } @else {
        <div class="trust trust--expanded">
          <p class="trust__head">
            <span
              class="trust__dot-wrap"
              [class.trust__dot-wrap--pulse]="t.pulsing"
              aria-hidden="true"
            >
              <app-dot size="sm" [color]="dotColor(t.tone)" />
            </span>
            <span class="trust__headline">{{ t.headline }}</span>
          </p>

          @if (t.progressPercent !== null) {
            <div
              class="trust__progress"
              role="progressbar"
              [attr.aria-valuenow]="t.progressPercent"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-label]="t.progressLabel ?? 'Синхронизация'"
            >
              <div class="trust__progress-meta">
                <span>{{ t.progressLabel }}</span>
                <span>{{ t.progressPercent }}%</span>
              </div>
              <app-progress-track variant="goal">
                <app-progress-fill [width]="t.progressPercent" />
              </app-progress-track>
            </div>
          }

          @if (t.cta.kind !== 'none') {
            <div class="trust__cta">
              @if (t.cta.kind === 'configure') {
                <a class="trust__cta-link" routerLink="/settings" fragment="iiko-sync">
                  {{ t.cta.label }}
                </a>
              } @else {
                <app-button
                  variant="pill"
                  [block]="true"
                  [disabled]="t.cta.disabled"
                  (pressed)="onCta(t.cta.kind)"
                >
                  {{ t.cta.label }}
                </app-button>
              }
            </div>
          }
        </div>
      }
    } @else if (loading()) {
      <p class="trust trust--compact trust--muted">Проверка…</p>
    }
  `,
  styles: `
    .trust--compact {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      font-size: 0.74rem;
      line-height: 1.4;
      font-weight: 600;
      color: var(--txt);
    }

    .trust--muted {
      color: var(--mut);
    }

    .trust--expanded {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .trust__head {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
    }

    .trust__headline {
      font-size: 0.74rem;
      line-height: 1.35;
      font-weight: 700;
      color: var(--txt);
    }

    .trust__dot-wrap {
      display: flex;
      align-items: center;
      flex: none;
      /* Высота = line-box заголовка — точка на одной линии с headline */
      height: calc(0.74rem * 1.35);
    }

    .trust__dot-wrap--pulse {
      animation: trust-pulse 1.4s ease-in-out infinite;
    }

    @keyframes trust-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.45;
      }
    }

    .trust__progress {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .trust__progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      color: var(--mut);
      font-weight: 600;
    }

    .trust__cta {
      margin-top: 2px;
    }

    .trust__cta-link {
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: center;
      text-decoration: none;
      border-radius: 99px;
      padding: 8px 12px;
      font-size: 0.74rem;
      font-weight: 700;
      color: var(--txt);
      background: var(--card2);
      border: 1px solid var(--line);

      &:hover {
        border-color: rgba(110, 107, 255, 0.45);
      }

      &:focus-visible {
        outline: 2px solid var(--vio);
        outline-offset: 2px;
      }
    }
  `,
})
export class TrustStripComponent {
  readonly trust = input<TrustStripVm | null>(null);
  readonly loading = input(false);

  readonly syncRequested = output<void>();
  readonly retryRequested = output<void>();

  protected dotColor(tone: AppStatusTone): string {
    if (tone === 'ok') return ATTENTION_TONE_COLOR.ok;
    if (tone === 'critical') return ATTENTION_TONE_COLOR.critical;
    return ATTENTION_TONE_COLOR.warn;
  }

  protected onCta(kind: TrustStripVm['cta']['kind']): void {
    if (kind === 'sync') this.syncRequested.emit();
    if (kind === 'retry') this.retryRequested.emit();
  }
}

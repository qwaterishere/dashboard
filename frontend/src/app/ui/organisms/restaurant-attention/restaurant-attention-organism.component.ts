import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { RestaurantAttentionVm } from '../../../shared/utils/restaurant-attention.utils';
import { ButtonComponent } from '../../atoms/button/button.component';
import { AttentionItemComponent } from '../../molecules/attention-item/attention-item.component';

@Component({
  selector: 'app-restaurant-attention-organism',
  standalone: true,
  imports: [RouterLink, ButtonComponent, AttentionItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="attn" aria-label="Сейчас важно">
      <section class="attn__block attn__block--primary" aria-labelledby="attn-now-title">
        <header class="attn__head">
          <h2 id="attn-now-title" class="attn__title">Сейчас важно</h2>
          @if (vm().summaryLabel) {
            <span class="attn__count">{{ vm().summaryLabel }}</span>
          }
        </header>

        @if (vm().loading && vm().items.length === 0 && !vm().domainsReady) {
          <div class="attn__skeleton" aria-hidden="true">
            <div class="attn__skel-line"></div>
            <div class="attn__skel-line"></div>
          </div>
        } @else if (vm().items.length === 0 && vm().domainsReady && !vm().loadError) {
          <div class="attn__ok">
            <p class="attn__ok-title">{{ vm().attentionOkMessage }}</p>
            <p class="attn__ok-hint">{{ vm().attentionOkHint }}</p>
          </div>
        } @else {
          <div class="attn__list">
            @for (item of vm().items; track item.id) {
              <app-attention-item
                [severity]="item.severity"
                [title]="item.title"
                [detail]="item.detail"
                [actionLabel]="item.actionLabel"
                [actionKind]="item.actionKind"
                [link]="item.link"
                [fragment]="item.fragment"
                [queryParams]="item.queryParams ?? null"
                (action)="onAttentionAction($event)"
              />
            }
          </div>
        }
      </section>

      <section class="attn__block attn__block--secondary" aria-labelledby="attn-data-title">
        <h2 id="attn-data-title" class="attn__title">Данные</h2>

        @if (vm().trust; as trust) {
          @if (!trust.expanded) {
            <p class="attn__trust-compact">
              <span
                class="attn__dot"
                [class.attn__dot--ok]="trust.tone === 'ok'"
                aria-hidden="true"
              ></span>
              {{ trust.compactLabel }}
            </p>
          } @else {
            <div class="attn__trust">
              <p class="attn__trust-head">
                <span
                  class="attn__dot"
                  [class.attn__dot--ok]="trust.tone === 'ok'"
                  [class.attn__dot--warn]="trust.tone === 'warn'"
                  [class.attn__dot--critical]="trust.tone === 'critical'"
                  [class.attn__dot--pulse]="trust.pulsing"
                  aria-hidden="true"
                ></span>
                <span class="attn__trust-headline">{{ trust.headline }}</span>
              </p>

              @if (trust.progressPercent !== null) {
                <div
                  class="attn__progress"
                  role="progressbar"
                  [attr.aria-valuenow]="trust.progressPercent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-label]="trust.progressLabel ?? 'Синхронизация'"
                >
                  <div class="attn__progress-meta">
                    <span>{{ trust.progressLabel }}</span>
                    <span>{{ trust.progressPercent }}%</span>
                  </div>
                  <div class="attn__progress-track">
                    <i [style.width.%]="trust.progressPercent"></i>
                  </div>
                </div>
              }

              @if (trust.cta.kind !== 'none') {
                <div class="attn__cta">
                  @if (trust.cta.kind === 'configure') {
                    <a class="attn__cta-link" routerLink="/settings" fragment="iiko-sync">
                      {{ trust.cta.label }}
                    </a>
                  } @else {
                    <app-button
                      variant="pill"
                      [block]="true"
                      [disabled]="trust.cta.disabled"
                      (pressed)="onCta(trust.cta.kind)"
                    >
                      {{ trust.cta.label }}
                    </app-button>
                  }
                </div>
              }
            </div>
          }
        } @else if (vm().loading) {
          <p class="attn__trust-compact attn__trust-compact--muted">Проверка…</p>
        }
      </section>
    </section>
  `,
  styleUrl: './restaurant-attention-organism.component.scss',
})
export class RestaurantAttentionOrganismComponent {
  readonly vm = input.required<RestaurantAttentionVm>();

  readonly syncRequested = output<void>();
  readonly retryRequested = output<void>();

  protected onCta(kind: 'sync' | 'configure' | 'retry' | 'none'): void {
    if (kind === 'sync') this.syncRequested.emit();
    if (kind === 'retry') this.retryRequested.emit();
  }

  protected onAttentionAction(kind: 'sync' | 'retry'): void {
    if (kind === 'sync') this.syncRequested.emit();
    if (kind === 'retry') this.retryRequested.emit();
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { RestaurantAttentionVm } from '../../../shared/utils/restaurant-attention.utils';
import { AttentionItemComponent } from '../../molecules/attention-item/attention-item.component';
import { TrustStripComponent } from '../../molecules/trust-strip/trust-strip.component';

@Component({
  selector: 'app-restaurant-attention-organism',
  standalone: true,
  imports: [AttentionItemComponent, TrustStripComponent],
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
        <app-trust-strip
          [trust]="vm().trust"
          [loading]="vm().loading && !vm().trust"
          (syncRequested)="syncRequested.emit()"
          (retryRequested)="retryRequested.emit()"
        />
      </section>
    </section>
  `,
  styleUrl: './restaurant-attention-organism.component.scss',
})
export class RestaurantAttentionOrganismComponent {
  readonly vm = input.required<RestaurantAttentionVm>();

  readonly syncRequested = output<void>();
  readonly retryRequested = output<void>();

  protected onAttentionAction(kind: 'sync' | 'retry'): void {
    if (kind === 'sync') this.syncRequested.emit();
    if (kind === 'retry') this.retryRequested.emit();
  }
}

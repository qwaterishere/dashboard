import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AttentionApi } from '../../../shared/models/attention.model';
import type { DataFreshness } from '../../../shared/models/data-freshness.model';
import { buildRestaurantAttentionVm } from '../../../shared/utils/restaurant-attention.utils';
import { RestaurantAttentionOrganismComponent } from './restaurant-attention-organism.component';

function freshness(partial: Partial<DataFreshness> = {}): DataFreshness {
  return {
    status: 'fresh',
    expectedDay: '2026-07-22',
    latestSalesDay: '2026-07-22',
    lagDays: 0,
    lastSyncAt: '2026-07-23T10:00:00.000Z',
    syncStatus: 'success',
    syncError: null,
    autoSyncEnabled: true,
    syncProgressPercent: null,
    syncPhase: null,
    stock: {
      latestDay: '2026-07-22',
      lagDays: 0,
      syncStatus: 'success',
      syncError: null,
      daysDone: null,
    },
    ...partial,
  };
}

function attention(partial: Partial<AttentionApi> = {}): AttentionApi {
  return {
    asOf: '2026-07-22',
    period: { year: 2026, month: 7 },
    domains: {
      stock: 'ready',
      foodcost: 'ready',
      revenue: 'ready',
      targets: 'ready',
    },
    negativeStock: { count: 0, valueAbs: 0 },
    foodcost: null,
    revenuePace: { risk: false, fact: 0, pace: null },
    monthPlan: { configured: true },
    ...partial,
  };
}

describe('RestaurantAttentionOrganismComponent', () => {
  let fixture: ComponentFixture<RestaurantAttentionOrganismComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestaurantAttentionOrganismComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RestaurantAttentionOrganismComponent);
  });

  it('emits syncRequested from trust CTA when expanded', () => {
    const sync = vi.fn();
    fixture.componentInstance.syncRequested.subscribe(sync);
    fixture.componentRef.setInput(
      'vm',
      buildRestaurantAttentionVm({
        attention: attention(),
        freshness: freshness({ status: 'stale', lagDays: 1 }),
        freshnessLoading: false,
        freshnessLoadError: false,
      }),
    );
    fixture.detectChanges();

    const btn = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === 'Обновить');
    btn?.click();
    expect(sync).toHaveBeenCalled();
  });

  it('shows ok message when clean', () => {
    fixture.componentRef.setInput(
      'vm',
      buildRestaurantAttentionVm({
        attention: attention(),
        freshness: freshness(),
        freshnessLoading: false,
        freshnessLoadError: false,
      }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Критичных отклонений нет');
  });
});

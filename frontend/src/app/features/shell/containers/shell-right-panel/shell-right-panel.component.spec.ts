import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { DataFreshnessService } from '../../../../core/data/data-freshness.service';
import { ThemeService } from '../../../../core/state/theme.service';
import { AttentionDataStore } from '../../data/attention-data.store';
import { SettingsService } from '../../../settings/services/settings.service';
import type { AttentionApi } from '../../../../shared/models/attention.model';
import type { DataFreshness } from '../../../../shared/models/data-freshness.model';
import { ShellRightPanelComponent } from './shell-right-panel.component';

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

function sampleAttention(): AttentionApi {
  return {
    asOf: '2026-07-22',
    period: { year: 2026, month: 7 },
    domains: {
      stock: 'ready',
      foodcost: 'ready',
      revenue: 'ready',
      targets: 'ready',
    },
    negativeStock: { count: 3, valueAbs: 12_000 },
    foodcost: null,
    revenuePace: { risk: false, fact: 0, pace: null },
    monthPlan: { configured: true },
  };
}

describe('ShellRightPanelComponent', () => {
  let fixture: ComponentFixture<ShellRightPanelComponent>;
  const syncIiko = vi.fn(() => of({ status: 'started' }));
  const attentionReload = vi.fn();
  const freshnessRefresh = vi.fn();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellRightPanelComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            initials: () => 'АК',
            displayName: () => 'Алексей К.',
            user: () => ({
              id: '1',
              email: 'a@b.c',
              first_name: 'Алексей',
              last_name: 'К',
              position: 'Управляющий',
              role: 'manager',
              created_at: '',
            }),
            isAuthenticated: () => true,
            logoutAndRedirect: vi.fn(),
          },
        },
        {
          provide: DataFreshnessService,
          useValue: {
            freshness: () => freshness({ status: 'stale', lagDays: 2 }),
            loading: () => false,
            loadError: () => false,
            refresh: freshnessRefresh,
          },
        },
        {
          provide: SettingsService,
          useValue: { syncIiko },
        },
        {
          provide: ThemeService,
          useValue: { theme: () => 'light', toggle: vi.fn() },
        },
        {
          provide: AttentionDataStore,
          useValue: {
            attention: () => sampleAttention(),
            isLoading: () => false,
            hasError: () => false,
            reload: attentionReload,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellRightPanelComponent);
    fixture.detectChanges();
  });

  it('renders weak spots with negative stock deep-link and sync CTA', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('aside')?.getAttribute('aria-label')).toContain('Сейчас важно');
    expect(root.textContent).toContain('Сейчас важно');
    expect(root.textContent).toMatch(/Минусовые остатки/);

    const stockLink = Array.from(root.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('К складу'),
    ) as HTMLAnchorElement | undefined;
    expect(stockLink?.getAttribute('href')).toContain('focus=negative');

    const syncBtn = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Обновить',
    ) as HTMLButtonElement | undefined;
    expect(syncBtn).toBeTruthy();
    syncBtn?.click();
    expect(syncIiko).toHaveBeenCalled();
    expect(attentionReload).toHaveBeenCalled();
    expect(freshnessRefresh).toHaveBeenCalledWith(true);
  });
});

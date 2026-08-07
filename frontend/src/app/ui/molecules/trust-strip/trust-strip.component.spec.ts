import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TrustStripVm } from '../../../shared/utils/restaurant-attention.utils';
import { TrustStripComponent } from './trust-strip.component';

function trust(partial: Partial<TrustStripVm> = {}): TrustStripVm {
  return {
    headline: 'Данные актуальны',
    tone: 'ok',
    pulsing: false,
    expanded: false,
    compactLabel: 'Актуально на 22 июля',
    progressPercent: null,
    progressLabel: null,
    cta: { kind: 'sync', label: 'Обновить', disabled: false },
    ...partial,
  };
}

describe('TrustStripComponent', () => {
  let fixture: ComponentFixture<TrustStripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrustStripComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TrustStripComponent);
  });

  it('renders compact label when not expanded', () => {
    fixture.componentRef.setInput('trust', trust());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Актуально на 22 июля');
  });

  it('emits syncRequested from expanded CTA', () => {
    const sync = vi.fn();
    fixture.componentInstance.syncRequested.subscribe(sync);
    fixture.componentRef.setInput(
      'trust',
      trust({
        expanded: true,
        headline: 'Данные отстают',
        tone: 'warn',
      }),
    );
    fixture.detectChanges();
    const btn = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === 'Обновить');
    btn?.click();
    expect(sync).toHaveBeenCalled();
  });

  it('shows loading placeholder when trust is null', () => {
    fixture.componentRef.setInput('trust', null);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Проверка');
  });
});

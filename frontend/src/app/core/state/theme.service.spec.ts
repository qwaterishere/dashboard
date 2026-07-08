import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  it('defaults to dark theme', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles and persists theme', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('sezony-theme')).toBe('light');
    service.toggle();
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
  });
});

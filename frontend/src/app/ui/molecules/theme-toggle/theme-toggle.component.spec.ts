import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeToggleComponent } from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ThemeToggleComponent);
  });

  it('pill shows theme label', () => {
    fixture.componentRef.setInput('variant', 'pill');
    fixture.componentRef.setInput('isDark', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Тёмная тема');
  });

  it('icon emits toggled', () => {
    const events: void[] = [];
    fixture.componentInstance.toggled.subscribe(() => events.push(undefined));
    fixture.componentRef.setInput('variant', 'icon');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button')?.click();
    expect(events).toHaveLength(1);
  });
});

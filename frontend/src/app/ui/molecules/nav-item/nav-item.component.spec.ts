import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NavItemComponent } from './nav-item.component';

describe('NavItemComponent', () => {
  let fixture: ComponentFixture<NavItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavItemComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NavItemComponent);
    fixture.componentRef.setInput('path', '/dashboard');
    fixture.componentRef.setInput('label', 'Дашборд');
  });

  it('highlights when active input is true', () => {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')?.classList.contains('on')).toBe(true);
  });

  it('does not highlight when active input is false', () => {
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')?.classList.contains('on')).toBe(false);
  });
});

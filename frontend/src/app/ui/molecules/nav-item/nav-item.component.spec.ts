import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { routes } from '../../../app.routes';
import { NavItemComponent } from './nav-item.component';

describe('NavItemComponent (integration)', () => {
  let router: Router;
  let fixture: ComponentFixture<NavItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavItemComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(NavItemComponent);
    fixture.componentRef.setInput('path', '/dashboard');
    fixture.componentRef.setInput('label', 'Дашборд');
  });

  it('highlights dashboard on /dashboard', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')?.classList.contains('on')).toBe(true);
  });

  it('navigates to dashboard from sales on click', async () => {
    await router.navigateByUrl('/sales');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('a')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/dashboard');
    expect(fixture.nativeElement.querySelector('a')?.classList.contains('on')).toBe(true);
  });
});

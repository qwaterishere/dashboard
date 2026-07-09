import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { App } from '../../../app';
import { routes } from '../../../app.routes';
import { provideMockAuthenticatedAuth } from '../../../core/auth/auth.testing';
import { NavActiveService } from '../../../core/routing/nav-active.service';

describe('App dashboard nav highlight (integration)', () => {
  let router: Router;
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideMockAuthenticatedAuth()],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });

  function dashboardLink(): HTMLAnchorElement {
    const links = [...fixture.nativeElement.querySelectorAll('app-nav-item a')] as HTMLAnchorElement[];
    const link = links.find((a) => a.textContent?.includes('Дашборд'));
    expect(link).toBeTruthy();
    return link!;
  }

  it('highlights dashboard on /dashboard', async () => {
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dashboardLink().classList.contains('on')).toBe(true);
  });

  it('navigates from sales to dashboard via sidebar click', async () => {
    await router.navigateByUrl('/sales');
    fixture.detectChanges();
    await fixture.whenStable();

    dashboardLink().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/dashboard');
    expect(TestBed.inject(NavActiveService).segment()).toBe('dashboard');
    expect(dashboardLink().classList.contains('on')).toBe(true);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { routes } from '../../app.routes';
import { provideMockAuthenticatedAuth } from '../auth/auth.testing';
import { NavActiveService, readPrimaryNavSegment } from './nav-active.service';

describe('readPrimaryNavSegment', () => {
  it('reads section from url path', () => {
    expect(readPrimaryNavSegment('/dashboard')).toBe('dashboard');
    expect(readPrimaryNavSegment('/sales')).toBe('sales');
    expect(readPrimaryNavSegment('/')).toBe('');
  });
});

describe('NavActiveService', () => {
  let router: Router;
  let service: NavActiveService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideMockAuthenticatedAuth()],
    }).compileComponents();

    router = TestBed.inject(Router);
    service = TestBed.inject(NavActiveService);
  });

  it('updates segment after navigation', async () => {
    await router.navigateByUrl('/dashboard');
    expect(service.segment()).toBe('dashboard');

    await router.navigateByUrl('/sales');
    expect(service.segment()).toBe('sales');
  });
});

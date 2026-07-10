import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { apiFallbackInterceptor } from './api-fallback.interceptor';

describe('apiFallbackInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiFallbackInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  it('falls back to static JSON when API is unreachable', async () => {
    const promise = firstValueFrom(client.get('/api/dashboard'));
    const api = http.expectOne('/api/dashboard');
    api.error(new ProgressEvent('error'), { status: 0 });

    const fallback = http.expectOne('/data/dashboard.json');
    fallback.flush({ period: { year: 2026, month: 6, dayFrom: 1, dayTo: 1 } });

    await expect(promise).resolves.toBeTruthy();
  });
});

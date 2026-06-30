import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { apiFallbackInterceptor } from './api-fallback.interceptor';

describe('apiFallbackInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiFallbackInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('falls back to static JSON when API fails', async () => {
    const promise = firstValueFrom(http.get<{ greeting: string }>('/api/dashboard'));
    const apiReq = httpMock.expectOne('/api/dashboard');
    apiReq.error(new ProgressEvent('error'));

    const fallbackReq = httpMock.expectOne('/data/dashboard.json');
    fallbackReq.flush({ greeting: 'Артём' });

    const data = await promise;
    expect(data.greeting).toBe('Артём');
  });

  it('does not fallback for unknown page names', () => {
    http.get('/api/evil').subscribe({
      error: () => undefined,
    });
    const req = httpMock.expectOne('/api/evil');
    req.error(new ProgressEvent('error'));
    httpMock.expectNone('/data/evil.json');
  });
});

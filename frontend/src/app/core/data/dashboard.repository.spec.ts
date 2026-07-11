import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';

import { API_CONFIG } from '../config/api-config.token';
import { DashboardRepository } from './dashboard.repository';

describe('DashboardRepository', () => {
  it('maps 200 with ETag header', async () => {
    const http = {
      get: vi.fn(() =>
        of(
          new HttpResponse({
            body: { period: { year: 2026, month: 6, dayFrom: 1, dayTo: 1 } },
            status: 200,
            headers: new HttpHeaders({ ETag: 'W/"abc"' }),
          }),
        ),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        DashboardRepository,
        { provide: API_CONFIG, useValue: { apiBase: '/api' } },
        { provide: HttpClient, useValue: http },
      ],
    });

    const repo = TestBed.inject(DashboardRepository);
    const result = await firstValueFrom(repo.fetch({ year: 2026, month: 6 }));
    expect(result).toEqual({
      kind: 'ok',
      data: { period: { year: 2026, month: 6, dayFrom: 1, dayTo: 1 } },
      etag: 'W/"abc"',
    });
  });
});

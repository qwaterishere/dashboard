import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadErrorComponent } from './load-error.component';
import { XSS_TEST_PAYLOADS, hasDangerousDom } from '../../../shared/security/xss-test.utils';

describe('LoadErrorComponent XSS safety', () => {
  let fixture: ComponentFixture<LoadErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadErrorComponent],
    }).compileComponents();
  });

  it.each(XSS_TEST_PAYLOADS)('escapes malicious payload: %s', (payload) => {
    fixture = TestBed.createComponent(LoadErrorComponent);
    fixture.componentRef.setInput('message', payload);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(hasDangerousDom(root)).toBe(false);
  });
});

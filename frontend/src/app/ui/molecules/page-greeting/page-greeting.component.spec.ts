import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideMockAuthenticatedAuth } from '../../../core/auth/auth.testing';
import { PageGreetingComponent } from './page-greeting.component';

describe('PageGreetingComponent', () => {
  let fixture: ComponentFixture<PageGreetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageGreetingComponent],
      providers: [provideMockAuthenticatedAuth()],
    }).compileComponents();

    fixture = TestBed.createComponent(PageGreetingComponent);
    fixture.detectChanges();
  });

  it('renders greeting with user first name', () => {
    expect(fixture.nativeElement.textContent).toMatch(/Добр(ое утро|ый день|ый вечер)/);
    expect(fixture.nativeElement.textContent).toContain('Артём');
  });
});

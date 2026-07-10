import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PageGreetingComponent } from './page-greeting.component';

describe('PageGreetingComponent', () => {
  let fixture: ComponentFixture<PageGreetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageGreetingComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PageGreetingComponent);
    fixture.componentRef.setInput('greeting', 'Добрый день, Артём');
    fixture.detectChanges();
  });

  it('renders greeting text', () => {
    expect(fixture.nativeElement.textContent).toContain('Добрый день, Артём');
  });
});

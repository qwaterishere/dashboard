import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageGreetingComponent } from './page-greeting.component';

describe('PageGreetingComponent', () => {
  let fixture: ComponentFixture<PageGreetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageGreetingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageGreetingComponent);
    fixture.detectChanges();
  });

  it('renders static greeting', () => {
    expect(fixture.nativeElement.textContent).toContain('Добрый вечер');
    expect(fixture.nativeElement.textContent).toContain('Артём');
  });
});

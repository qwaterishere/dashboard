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
  });

  it('renders greeting with accent', () => {
    fixture.componentRef.setInput('headline', 'Добрый день, Артём');
    fixture.componentRef.setInput('variant', 'greeting');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Добрый день, Артём');
    expect(fixture.nativeElement.querySelector('em')).not.toBeNull();
  });

  it('renders page title without accent', () => {
    fixture.componentRef.setInput('headline', 'Продажи');
    fixture.componentRef.setInput('variant', 'title');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Продажи');
    expect(fixture.nativeElement.querySelector('em')).toBeNull();
  });
});
